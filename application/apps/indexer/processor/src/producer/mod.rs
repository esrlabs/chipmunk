#[cfg(test)]
mod tests;

use log::warn;
use parsers::{Error as ParserError, LogMessage, Parser};
use sources::{ByteSource, ReloadInfo, SourceFilter};
use std::marker::PhantomData;

mod logs_collector;

pub use logs_collector::{LogRecordsCollector, GeneralLogCollector};

/// Number of bytes to skip on initial parse errors before terminating the session.
const INITIAL_PARSE_ERROR_LIMIT: usize = 1024;

/// Represents the producer state and processing infos after calling `produce_next()`
/// on messages producer.
#[derive(Debug)]
pub enum ProduceSummary {
    /// Bytes has loaded and parsed and items has been produced.
    Processed {
        /// Total number of bytes consumed from the input buffer.
        bytes_consumed: usize,
        /// Number of messages that were parsed and appended to logs collector.
        messages_count: usize,
        /// Number of bytes that has been skipped.
        skipped_bytes: usize,
    },
    /// No more bytes are available in the byte-source currently.
    NoBytesAvailable{
        /// The amount of skipped bytes in the last `produce_next()` call
        skipped_bytes: usize,
    }, 
    /// Producer is done. No more bytes will be loaded nor new items will be parsed.
    Done {
        /// Total bytes count which has been loaded during the session.
        loaded_bytes: usize,
        /// Total amount of bytes which has been skipped during the session.
        skipped_bytes: usize,
        /// Total amount of messages that have been produced during the session.
        produced_messages: usize,
    }
}

/// Represents Error types which could occur during `produce_next()` call.
#[derive(Debug, thiserror::Error)]
pub enum ProduceError {
    /// Unrecoverable error. Producer can't be used anymore.
    #[error("Unrecoverable Producer Error: {0}")]
    Unrecoverable(String),
    /// Error from the underlying byte source (Usually unrecoverable).
    #[error("Data Source Error: {0}")]
    SourceError(#[from] sources::Error),
    /// Parsing error (Recoverable) from the underlying parser.
    #[error("Parsing Error: {0}")]
    Parse(String),
}

#[derive(Debug)]
pub struct MessageProducer<T, P, D>
where
    T: LogMessage,
    P: Parser<T>,
    D: ByteSource,
{
    byte_source: D,
    parser: P,
    filter: Option<SourceFilter>,
    last_seen_ts: Option<u64>,
    _phantom_data: Option<PhantomData<T>>,
    total_loaded: usize,
    total_skipped: usize,
    total_messages: usize,
    done: bool,
}

impl<T: LogMessage, P: Parser<T>, D: ByteSource> MessageProducer<T, P, D> {
    /// create a new producer by plugging into a byte source
    pub fn new(parser: P, source: D) -> Self {
        MessageProducer {
            byte_source: source,
            parser,
            filter: None,
            last_seen_ts: None,
            _phantom_data: None,
            total_loaded: 0,
            total_skipped: 0,
            total_messages: 0,
            done: false,
        }
    }

    /// Loads the next segment of bytes, parses them, and append them to the provided
    /// [`LogRecordsCollector`].
    ///
    /// # Cancel Safety:
    /// This function is cancel safe as long [`ByteSource::load()`] method on used byte source is
    /// safe as well.
    ///
    /// # Return:
    /// Summary of producer state with infos about consumed, skipped bytes and produced log 
    /// messages, otherwise it'll return a producer error.
    pub async fn produce_next<C: LogRecordsCollector<T>>(
        &mut self,
        collector: &mut C,
    ) -> Result<ProduceSummary, ProduceError> {
        // ### Cancel Safety ###:
        // This function is cancel safe because:
        // * there is no await calls or any function causing yielding between filling the internal
        //   buffer and returning it.
        // * Byte source will keep the loaded data in its internal buffer ensuring there
        //   is no data loss when cancelling happen between load calls.
        
        if self.done {
            debug!("done...no next segment");
            return Ok(self.final_report());
        }
        let (_newly_loaded, mut skipped_bytes) = self.load().await?;

        loop {
            let current_slice = self.byte_source.current_slice();
            debug!(
                "current slice: (len: {}) (total {})",
                current_slice.len(),
                self.total_loaded
            );

            let mut available = current_slice.len();
            if available == 0 {
                trace!("No more bytes available from source");

                return Ok(ProduceSummary::NoBytesAvailable { skipped_bytes });
            }

            let mut bytes_consumed = 0;
            let mut messages_count = 0;

            match self
                .parser
                .parse(self.byte_source.current_slice(), self.last_seen_ts)
                .map(|iter| {
                    iter.for_each(|item| match item {
                        (consumed, Some(m)) => {
                            let total_used_bytes = consumed + skipped_bytes;
                            debug!(
                            "Extracted a valid message, consumed {consumed} bytes (total used {total_used_bytes} bytes)"
                            );
                            bytes_consumed += consumed;
                            messages_count += 1;
                            collector.append(m);
                        }
                        (skipped, None) => {
                            bytes_consumed += skipped;
                            skipped_bytes += skipped;
                            trace!("None, consumed {skipped} bytes");
                        }
                    })
                }) {
                Ok(()) => {
                    self.byte_source.consume(bytes_consumed);
                    self.total_messages += messages_count;

                    return Ok(ProduceSummary::Processed { bytes_consumed, messages_count, skipped_bytes });
                }
                Err(ParserError::Incomplete) => {
                    trace!("not enough bytes to parse a message. Load more data");
                    let (newly_loaded, skipped) = self.load().await?;

                    if newly_loaded > 0 {
                        trace!("New bytes has been loaded, trying parsing again.");
                        skipped_bytes += skipped;
                    } else {
                        trace!("No bytes has been loaded, drop one byte if available or load");

                        if !self.drop_and_load(&mut available, &mut skipped_bytes).await? {
                            trace!(
                                "No available bytes after drop and load"
                            );

                            return Ok(ProduceSummary::NoBytesAvailable { skipped_bytes });
                        }
                    }
                }
                Err(ParserError::Eof) => {
                    trace!("EOF reached...no more messages (skipped_bytes={skipped_bytes})");
                    self.done = true;

                    return Ok(self.final_report());
                }
                Err(ParserError::Parse(s)) => {
                    // TODO: This is temporary solution. We need to inform the user each time we
                    // hit the `INITIAL_PARSE_ERROR_LIMIT` and not break the session.
                    // We may need the new item `MessageStreamItem::Skipped(bytes_count)`
                    //
                    // Return early when initial parse calls fail after consuming one megabyte.
                    // This can happen when provided bytes aren't suitable for the select parser.
                    // In such case we close the session directly to avoid having unresponsive
                    // state while parse is calling on each skipped byte in the source.
                    if !self.did_produce_items() && skipped_bytes > INITIAL_PARSE_ERROR_LIMIT {
                        let err_msg = format!("Aborting session due to failing initial parse call with the error: {s}");
                        warn!("{err_msg}");

                        self.done = true;
                        
                        return Err(ProduceError::Unrecoverable(err_msg));
                    }

                    trace!("No parse possible, skip one byte and retry. Error: {s}");
                    if self.drop_and_load(&mut available, &mut skipped_bytes).await? {
                        continue;
                    } else {
                        trace!(
                            "Return the last error parse as no available bytes after drop and load"
                        );

                        return Err(ProduceError::Parse(s));
                    }
                }
                Err(ParserError::Unrecoverable(err)) => {
                    error!("Parsing failed: Error {err}");
                    self.done = true;
                    
                    return Err(ProduceError::Unrecoverable(err));
                }
            }
        }
    }

    /// Calls load on the underline byte source filling it with more bytes.
    /// Returning information about the state of the byte counts on success, or the 
    /// corresponding source error on fail.
    ///
    /// # Return:
    /// Result<(newly_loaded_bytes, skipped_bytes), sources::Error>
    async fn load(&mut self) -> Result<(usize, usize), sources::Error> {
        match self.byte_source.load(self.filter.as_ref()).await? {
            Some(ReloadInfo {
                newly_loaded_bytes,
                available_bytes: _,
                skipped_bytes,
                last_known_ts,
            }) => {
                self.total_loaded += newly_loaded_bytes;
                self.total_skipped += skipped_bytes;
                if let Some(ts) = last_known_ts {
                    self.last_seen_ts = Some(ts);
                }
                trace!(
                    "did a do_reload, skipped {} bytes, loaded {} more bytes (total loaded and skipped: {})",
                    skipped_bytes,
                    newly_loaded_bytes,
                    self.total_loaded + self.total_skipped
                );
                Ok((newly_loaded_bytes, skipped_bytes))
            }
            None => {
                trace!("byte_source.reload result was None");
                Ok((0, 0))
            }
        }
    }

    /// Drops one byte from the available bytes and loads more bytes if no more bytes are
    /// available.
    ///
    /// # Note:
    /// This function is intended for internal use in producer loop only.
    ///
    /// # Return:
    /// `true` when there are available bytes to be parsed, otherwise it'll return `false`
    /// indicating that the session should be terminated.
    async fn drop_and_load(&mut self, available: &mut usize, skipped_bytes: &mut usize) -> Result<bool, sources::Error> {
        if *available > 0 {
            trace!("Dropping one byte from loaded ones.");
            const DROP_STEP: usize = 1;
            *available -= DROP_STEP;
            *skipped_bytes += DROP_STEP;
            self.byte_source.consume(DROP_STEP);

            // we still have bytes -> call parse on the remaining bytes without loading.
            if *available > 0 {
                return Ok(true);
            }
        }

        // Load more bytes.
        trace!("No more bytes are available. Loading more bytes");
        let (newly_loaded, skipped) = self.load().await?; 
                *available = self.byte_source.len();
                *skipped_bytes += skipped;
        Ok(newly_loaded > 0)
    }

    /// Checks if the producer have already produced any parsed items in the current session.
    #[inline]
    fn did_produce_items(&self) -> bool {
        self.total_messages > 0
    }

    /// Returns [`ProduceStatus::Done`] with summary for producer session.
    fn final_report(&self) -> ProduceSummary {
        ProduceSummary::Done {
            loaded_bytes: self.total_loaded,
            skipped_bytes: self.total_skipped,
            produced_messages: self.total_messages,
        }
    }

    /// Total loaded bytes form byte source in this session.
    #[inline]
    pub fn total_loaded_bytes(&self) -> usize {
        self.total_loaded
    }
    
    /// Total skipped bytes by source and parser in this session.
    #[inline]
    pub fn total_skipped_bytes(&self) -> usize {
        self.total_skipped
    }

    /// Total amount of parsed items produced in this session.
    #[inline]
    pub fn total_produced_items(&self) -> usize {
        self.total_messages
    }

    /// Append incoming (SDE) Source-Data-Exchange to the underline byte source data.
    pub async fn sde_income(
        &mut self,
        msg: stypes::SdeRequest,
    ) -> Result<stypes::SdeResponse, sources::Error> {
        self.byte_source.income(msg).await
    }
}
