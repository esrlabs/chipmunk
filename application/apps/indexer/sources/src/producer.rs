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
    /// MessageStreamItem
    pub fn as_stream(&mut self) -> impl Stream<Item = (usize, MessageStreamItem<T>)> + '_ {
        stream! {
            while let Some(items) = self.read_next_segment().await {
                for item in items {
                    yield item;
                }
            }
        }
    }

    async fn read_next_segment(&mut self) -> Option<Vec<(usize, MessageStreamItem<T>)>> {
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
                        read = self.do_reload() => Next::Read(read.unwrap_or((0, 0, 0))),
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
                break 'outer self.do_reload().await.unwrap_or((0, 0, 0));
            };
        };
        let mut call_parse = true;
        // 1. buffer loaded? if not, fill buffer with frame data
        // 2. try to parse message from buffer
        // 3a. if message, pop it of the buffer and deliever
        // 3b. else reload into buffer and goto 2
        while call_parse {
            call_parse = false;
            let current_slice = self.byte_source.current_slice();
            debug!(
                "current slice: (len: {}) (total {})",
                current_slice.len(),
                self.total_loaded
            );
            if available == 0 {
                trace!("No more bytes available from source");
                self.done = true;
                return Some(vec![(0, MessageStreamItem::Done)]);
            }
            let parse_results = self
                .parser
                .parse(self.byte_source.current_slice(), self.last_seen_ts);

            let mut results = Vec::with_capacity(parse_results.len());

            for parse_res in parse_results {
                match parse_res {
                    Ok((consumed, Some(m))) => {
                        let total_used_bytes = consumed + skipped_bytes;
                        debug!(
                            "Extracted a valid message, consumed {} bytes (total used {} bytes)",
                            consumed, total_used_bytes
                        );
                        self.byte_source.consume(consumed);
                        results.push((total_used_bytes, MessageStreamItem::Item(m)));
                    }
                    Ok((consumed, None)) => {
                        self.byte_source.consume(consumed);
                        trace!("None, consumed {} bytes", consumed);
                        let total_used_bytes = consumed + skipped_bytes;
                        results.push((total_used_bytes, MessageStreamItem::Skipped));
                    }
                    Err(ParserError::Incomplete) => {
                        //TODO AAZ: Make sure this is the last results
                        // This Error is currently not implemented by the parsers but it should be
                        // used when the parsers reaches the last bytes of the given buffer and
                        // can't parse them anymore. Currently Parse Error is returned
                        trace!("not enough bytes to parse a message");
                        if results.is_empty() {
                            let (reloaded, _available_bytes, skipped) = self.do_reload().await?;
                            available += reloaded;
                            skipped_bytes += skipped;
                            // Call parser again
                            call_parse = true;
                        }
                    }
                    Err(ParserError::Eof) => {
                        //TODO AAZ: Make sure this is the last results
                        trace!(
                            "EOF reached...no more messages (skipped_bytes={})",
                            skipped_bytes
                        );
                    }
                    Err(ParserError::Parse(s)) => {
                        //TODO AAZ: Make sure this is the last results
                        // Currently, the parse error message indicates that the parse reaches the
                        // last bytes from the current buffer that can't be parsed.
                        // In this case if we don't have other results we will assume that an error
                        // has happened. Otherwise, we return the current results and after that
                        // parser will be called again.

                        if results.is_empty() {
                            trace!(
                                "No parse possible, try next batch of data ({}), skipped {} more bytes ({} already)",
                                s, available, skipped_bytes
                            );
                            // skip all currently available bytes
                            self.byte_source.consume(available);
                            skipped_bytes += available;
                            available = self.byte_source.len();
                            if let Some((reloaded, _available_bytes, skipped)) =
                                self.do_reload().await
                            {
                                available += reloaded;
                                skipped_bytes += skipped;
                                call_parse = true;
                            } else {
                                let unused = skipped_bytes + available;
                                self.done = true;
                                return Some(vec![(unused, MessageStreamItem::Done)]);
                            }
                        }
                    }
                }
                if call_parse {
                    assert!(results.is_empty());
                    continue;
                }

                if results.is_empty() {
                    return None;
                } else {
                    return Some(results);
                }
            }
        }

        unreachable!()
    }

    async fn do_reload(&mut self) -> Option<(usize, usize, usize)> {
        match self.byte_source.reload(self.filter.as_ref()).await {
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
                None
            }
            Err(e) => {
                warn!("Error reloading content: {}", e);
                None
            }
        }
    }
}
