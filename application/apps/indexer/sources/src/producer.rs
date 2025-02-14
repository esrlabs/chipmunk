#[cfg(test)]
mod tests;

use crate::{sde::SdeMsg, ByteSource, ReloadInfo, SourceFilter};
use async_stream::stream;
use log::warn;
use parsers::{Error as ParserError, LogMessage, MessageStreamItem, Parser};
use std::marker::PhantomData;
use tokio::{
    select,
    sync::mpsc::{UnboundedReceiver, UnboundedSender},
};
use tokio_stream::Stream;

pub type SdeSender = UnboundedSender<SdeMsg>;
pub type SdeReceiver = UnboundedReceiver<SdeMsg>;

/// The maximum number of allowed continuous incomplete errors before skipping
/// some bytes in the internal buffer.
const MAX_INCOMPLETE_ATTEMPTS: usize = 3;

enum Next {
    Read((usize, usize, usize)),
    Sde(Option<SdeMsg>),
}

#[derive(Debug)]
pub struct MessageProducer<T, P, D>
where
    T: LogMessage,
    P: Parser<T>,
    D: ByteSource,
{
    byte_source: D,
    index: usize,
    parser: P,
    filter: Option<SourceFilter>,
    last_seen_ts: Option<u64>,
    _phantom_data: Option<PhantomData<T>>,
    total_loaded: usize,
    total_skipped: usize,
    done: bool,
    rx_sde: Option<SdeReceiver>,
}

impl<T: LogMessage, P: Parser<T>, D: ByteSource> MessageProducer<T, P, D> {
    /// create a new producer by plugging into a byte source
    pub fn new(parser: P, source: D, rx_sde: Option<SdeReceiver>) -> Self {
        MessageProducer {
            byte_source: source,
            index: 0,
            parser,
            filter: None,
            last_seen_ts: None,
            _phantom_data: None,
            total_loaded: 0,
            total_skipped: 0,
            done: false,
            rx_sde,
        }
    }
    /// create a stream of pairs that contain the count of all consumed bytes and the
    /// MessageStreamItems in a boxed slice
    pub fn as_stream(&mut self) -> impl Stream<Item = Box<[(usize, MessageStreamItem<T>)]>> + '_ {
        stream! {
            while let Some(items) = self.read_next_segment().await {
                yield items;
            }
        }
    }

    async fn read_next_segment(&mut self) -> Option<Box<[(usize, MessageStreamItem<T>)]>> {
        if self.done {
            debug!("done...no next segment");
            return None;
        }
        self.index += 1;
        let (_newly_loaded, mut available, mut skipped_bytes) = 'outer: loop {
            if let Some(mut rx_sde) = self.rx_sde.take() {
                'inner: loop {
                    // SDE mode: listening next chunk and possible incoming message for source
                    match select! {
                        msg = rx_sde.recv() => Next::Sde(msg),
                        read = self.load() => Next::Read(read.unwrap_or((0, 0, 0))),
                    } {
                        Next::Read(next) => {
                            self.rx_sde = Some(rx_sde);
                            break 'outer next;
                        }
                        Next::Sde(msg) => {
                            if let Some((msg, tx_response)) = msg {
                                if tx_response
                                    .send(
                                        self.byte_source
                                            .income(msg)
                                            .await
                                            .map_err(|e| e.to_string()),
                                    )
                                    .is_err()
                                {
                                    warn!("Fail to send back message from source");
                                }
                            } else {
                                // Means - no more senders; but it isn't an error as soon as implementation of
                                // source could just do not use a data exchanging
                                self.rx_sde = None;
                                // Exiting from inner loop to avoid select! and go to NoSDE mode
                                break 'inner;
                            }
                        }
                    }
                }
            } else {
                // NoSDE mode: listening only next chunk
                break 'outer self.load().await.unwrap_or((0, 0, 0));
            };
        };

        let mut incomplete_count = 0;
        let mut incomplete_consume = 0;

        // 1. buffer loaded? if not, fill buffer with frame data
        // 2. try to parse message from buffer
        // 3a. if message, pop it of the buffer and deliver
        // 3b. else reload into buffer and goto 2
        loop {
            let current_slice = self.byte_source.current_slice();
            // `available` and `current_slice.len()` represent the same value but can go out of sync.
            // The general unit tests for byte-sources catches this behavior but this assertion is
            // for new sources to ensure that they are included in the general tests for sources.
            debug_assert_eq!(
                available,
                current_slice.len(),
                "available bytes must always match current slice length. 
                Note: Ensure the current byte source is covered with the general unit tests"
            );

            debug!(
                "current slice: (len: {}) (total {})",
                current_slice.len(),
                self.total_loaded
            );
            if available == 0 {
                trace!("No more bytes available from source");
                self.done = true;
                return Some(Box::new([(0, MessageStreamItem::Done)]));
            }

            // we can call consume only after all parse results are collected because of its
            // reference to self.
            let mut total_consumed = 0;

            match self
                .parser
                .parse(self.byte_source.current_slice(), self.last_seen_ts)
                .map(|iter| {
                    iter.map(|item| match item {
                        (consumed, Some(m)) => {
                            let total_used_bytes = consumed + skipped_bytes;
                            // Reset skipped bytes since it had been counted here.
                            skipped_bytes = 0;
                            debug!(
                            "Extracted a valid message, consumed {} bytes (total used {} bytes)",
                            consumed, total_used_bytes
                        );
                            total_consumed += consumed;
                            (total_used_bytes, MessageStreamItem::Item(m))
                        }
                        (consumed, None) => {
                            total_consumed += consumed;
                            trace!("None, consumed {} bytes", consumed);
                            let total_used_bytes = consumed + skipped_bytes;
                            // Reset skipped bytes since it had been counted here.
                            skipped_bytes = 0;
                            (total_used_bytes, MessageStreamItem::Skipped)
                        }
                    })
                    .collect::<Box<[_]>>()
                }) {
                Ok(items) => {
                    self.byte_source.consume(total_consumed);
                    return Some(items);
                }
                Err(ParserError::Incomplete) => {
                    trace!("not enough bytes to parse a message");

                    match incomplete_count {
                        // Mark consume amount on first incomplete error only to avoid skipping too
                        // much bytes.
                        0 => incomplete_consume = available,

                        // Skip the bytes from first incomplete attempt and retry parsing.
                        MAX_INCOMPLETE_ATTEMPTS => {
                            self.byte_source.consume(incomplete_consume);
                            skipped_bytes += incomplete_consume;
                            available = self.byte_source.len();

                            // Reset incomplete variables.
                            incomplete_consume = 0;
                            incomplete_count = 0;

                            continue;
                        }
                        _ => {}
                    }
                    incomplete_count += 1;

                    let (newly_loaded, _available_bytes, skipped) = self.load().await?;

                    // Stop if there is no new available bytes.
                    if newly_loaded == 0 {
                        trace!("No new bytes has been added. Returning Done");
                        let unused = skipped_bytes + available;
                        self.done = true;

                        return Some(Box::new([(unused, MessageStreamItem::Done)]));
                    }

                    trace!("New bytes has been loaded, trying parsing again.");
                    available += newly_loaded;
                    skipped_bytes += skipped;
                    continue;
                }
                Err(ParserError::Eof) => {
                    trace!(
                        "EOF reached...no more messages (skipped_bytes={})",
                        skipped_bytes
                    );
                    self.done = true;

                    return None;
                }
                Err(ParserError::Parse(s)) => {
                    trace!(
                    "No parse possible, try next batch of data ({}), skipped {} more bytes ({} already)",
                    s, available, skipped_bytes
                );
                    // skip all currently available bytes
                    self.byte_source.consume(available);
                    skipped_bytes += available;
                    available = self.byte_source.len();

                    let loaded_new_data = match self.load().await {
                        Some((newly_loaded, _available_bytes, skipped)) => {
                            available += newly_loaded;
                            skipped_bytes += skipped;

                            newly_loaded > 0
                        }
                        None => false,
                    };

                    // Finish if no new data are available.
                    if !loaded_new_data {
                        let unused = skipped_bytes + available;
                        self.done = true;
                        return Some(Box::new([(unused, MessageStreamItem::Done)]));
                    }
                }
            }
        }
    }

    /// Calls load on the underline byte source filling it with more bytes.
    /// Returning information about the state of the byte counts, Or None if
    /// the reload call fails.
    ///
    /// # Return:
    ///
    /// Option<(newly_loaded_bytes, available_bytes, skipped_bytes)>
    async fn load(&mut self) -> Option<(usize, usize, usize)> {
        match self.byte_source.load(self.filter.as_ref()).await {
            Ok(Some(ReloadInfo {
                newly_loaded_bytes,
                available_bytes,
                skipped_bytes,
                last_known_ts,
            })) => {
                self.total_loaded += newly_loaded_bytes;
                self.total_skipped += skipped_bytes;
                if let Some(ts) = last_known_ts {
                    self.last_seen_ts = Some(ts);
                }
                trace!(
                    "did a do_reload, skipped {} bytes, loaded {} more bytes (total loaded and skipped: {})",
                    skipped_bytes, newly_loaded_bytes, self.total_loaded + self.total_skipped
                );
                Some((newly_loaded_bytes, available_bytes, skipped_bytes))
            }
            Ok(None) => {
                trace!("byte_source.reload result was None");
                if self.byte_source.current_slice().is_empty() {
                    trace!("byte_source.current_slice() is empty. Returning None");

                    None
                } else {
                    trace!("byte_source still have some bytes. Returning them");

                    Some((0, self.byte_source.len(), 0))
                }
            }
            Err(e) => {
                // In error case we don't need to consider the available bytes.
                warn!("Error reloading content: {}", e);
                None
            }
        }
    }
}
