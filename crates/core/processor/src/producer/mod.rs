//! Connects a [`ByteSource`] with a [`Parser`], driving the ingestion pipeline of a session.

#[cfg(test)]
mod tests;

use log::warn;
use parsers::{Error as ParserError, ParseOutput, Parser};
use sources::{ByteSource, ReloadInfo, SourceFilter};

mod logs_collector;

pub use logs_collector::{GeneralLogCollector, LogRecordsCollector};

/// Number of bytes to skip on initial parse errors before terminating the session.
const INITIAL_PARSE_ERROR_LIMIT: usize = 1024;

/// Number of bytes dropped on each resync attempt after the parser rejected the current bytes.
const DROP_STEP: usize = 1;

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
    NoBytesAvailable {
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
    },
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

/// Info about the bytes that a [`MessageProducer::fetch()`] call made available.
///
/// Deliberately not `Clone`, `Copy` or constructible outside this module: the only way to get
/// one is [`MessageProducer::fetch()`], and [`MessageProducer::process()`] consumes it by value.
/// That makes "process bytes only after fetching them, at most once per fetch" a fact the
/// compiler checks rather than a convention documented on the two methods.
#[derive(Debug)]
pub struct FetchInfo {
    /// Bytes newly loaded into the source buffer by this call.
    newly_loaded_bytes: usize,
    /// Bytes the source had to skip to reach usable data.
    skipped_bytes: usize,
}

/// Result of a [`MessageProducer::process()`] call.
#[derive(Debug)]
pub enum ProcessOutcome {
    /// Bytes were parsed and the items appended to the collector.
    Parsed {
        /// Total number of bytes consumed from the input buffer.
        bytes_consumed: usize,
        /// Number of messages that were parsed and appended to logs collector.
        messages_count: usize,
        /// Bytes skipped by the parser or dropped while resyncing.
        skipped_bytes: usize,
    },
    /// The parser needs more bytes. Call [`MessageProducer::fetch()`] again, then
    /// [`MessageProducer::process()`] again.
    NeedMoreBytes,
    /// No bytes are available in the source right now. The caller decides whether that
    /// means "wait for more" (tailing) or "stop".
    NoData,
    /// The parser signalled end of data. The producer is finished and will stay finished.
    Done,
}

/// Represents Error types which could occur during [`MessageProducer::process()`] call.
#[derive(Debug, thiserror::Error)]
pub enum ProcessError {
    /// Unrecoverable error. Producer can't be used anymore.
    #[error("Unrecoverable Producer Error: {0}")]
    Unrecoverable(String),
    /// Parsing error (Recoverable) from the underlying parser.
    #[error("Parsing Error: {0}")]
    Parse(String),
}

impl From<ProcessError> for ProduceError {
    fn from(value: ProcessError) -> Self {
        match value {
            ProcessError::Unrecoverable(msg) => ProduceError::Unrecoverable(msg),
            ProcessError::Parse(msg) => ProduceError::Parse(msg),
        }
    }
}

/// The producer's current status: exactly one of running, resyncing after a rejected parse, or
/// finished.
#[derive(Debug, Default)]
enum ProducerStatus {
    /// Parsing normally.
    #[default]
    Running,
    /// The parser rejected the current bytes; kept so it can be delivered once the byte source
    /// proves it has nothing more to give.
    ParserErrored { msg: String },
    /// End of data or an unrecoverable error. No more loading or parsing will happen.
    Done,
}

/// Produces parsed log items by feeding the bytes of a [`ByteSource`] into a [`Parser`],
/// keeping track of the totals of the running session.
#[derive(Debug)]
pub struct MessageProducer<P, D>
where
    P: Parser,
    D: ByteSource,
{
    byte_source: D,
    parser: P,
    filter: Option<SourceFilter>,
    last_seen_ts: Option<u64>,
    total_loaded: usize,
    total_skipped: usize,
    total_messages: usize,
    /// Bytes dropped while resyncing the parser, which is the budget the
    /// [`INITIAL_PARSE_ERROR_LIMIT`] guard spends.
    total_dropped: usize,
    status: ProducerStatus,
}

impl<P: Parser, D: ByteSource> MessageProducer<P, D> {
    /// Creates a new producer by plugging the given parser into the given byte source.
    pub fn new(parser: P, source: D) -> Self {
        MessageProducer {
            byte_source: source,
            parser,
            filter: None,
            last_seen_ts: None,
            total_loaded: 0,
            total_skipped: 0,
            total_messages: 0,
            total_dropped: 0,
            status: ProducerStatus::default(),
        }
    }

    /// Whether the producer is finished: no more loading or parsing will happen.
    #[inline]
    fn is_done(&self) -> bool {
        matches!(self.status, ProducerStatus::Done)
    }

    /// Loads the next segment of bytes from the byte source into its internal buffer.
    ///
    /// This is the loading half of the producer. It never parses and never touches the logs
    /// collector: use [`Self::process()`] for that.
    ///
    /// # Cancel Safety:
    /// This is the only awaiting step of the producer and it is cancel safe as long as
    /// [`ByteSource::load()`] is (the trait requires it). Dropping this future loses no bytes:
    /// everything loaded lives in the source's internal buffer.
    ///
    /// # Return:
    /// Infos about the bytes this call made available, or the error of the underlying byte
    /// source on fail.
    pub async fn fetch(&mut self) -> Result<FetchInfo, sources::Error> {
        // A finished producer must stay finished and must never touch the source again.
        if self.is_done() {
            return Ok(FetchInfo {
                newly_loaded_bytes: 0,
                skipped_bytes: 0,
            });
        }

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
                    "did a do_reload, skipped {skipped_bytes} bytes, loaded {newly_loaded_bytes} more bytes (total loaded and skipped: {})",
                    self.total_loaded + self.total_skipped
                );

                let info = FetchInfo {
                    newly_loaded_bytes,
                    skipped_bytes,
                };

                Ok(info)
            }
            None => {
                trace!("byte_source.reload result was None");

                let info = FetchInfo {
                    newly_loaded_bytes: 0,
                    skipped_bytes: 0,
                };

                Ok(info)
            }
        }
    }

    /// Parses the bytes currently held by the byte source and appends the produced items to the
    /// given `collector`.
    ///
    /// This is the parsing half of the producer. It never loads: when it needs more bytes it
    /// says so with [`ProcessOutcome::NeedMoreBytes`] and the caller must run [`Self::fetch()`]
    /// again to obtain a new `fetch_info` before calling this method again.
    ///
    /// # Return:
    /// The outcome of the parse attempt, or a producer error.
    pub fn process<C: LogRecordsCollector<P::Output>>(
        &mut self,
        fetch_info: FetchInfo,
        collector: &mut C,
    ) -> Result<ProcessOutcome, ProcessError> {
        if self.is_done() {
            debug!("done...no next segment");

            return Ok(ProcessOutcome::Done);
        }

        // Bytes skipped within this call: reported by the parser plus the ones dropped while
        // resyncing after a parse error.
        let mut skipped_bytes = 0;

        loop {
            let available = self.byte_source.current_slice().len();
            debug!(
                "current slice: (len: {available}) (total {})",
                self.total_loaded
            );

            if available == 0 {
                // The buffer is dry, either on entry or because resyncing dropped its last byte.
                return self.on_empty_buffer(fetch_info.newly_loaded_bytes);
            }

            let mut bytes_consumed = 0;
            let mut messages_count = 0;
            let mut parser_skipped = 0;

            match self
                .parser
                .parse(self.byte_source.current_slice(), self.last_seen_ts)
                .map(|iter| {
                    iter.for_each(|item| match item {
                        ParseOutput {
                            consumed,
                            message: Some(m),
                        } => {
                            debug!("Extracted a valid message, consumed {consumed} bytes");
                            bytes_consumed += consumed;
                            messages_count += 1;
                            collector.append(m);
                        }
                        ParseOutput {
                            consumed: skipped,
                            message: None,
                        } => {
                            bytes_consumed += skipped;
                            parser_skipped += skipped;
                            trace!("None, consumed {skipped} bytes");
                        }
                    })
                }) {
                Ok(()) => {
                    self.byte_source.consume(bytes_consumed);
                    self.total_messages += messages_count;
                    self.total_skipped += parser_skipped;
                    skipped_bytes += parser_skipped;
                    self.status = ProducerStatus::Running;

                    let parsed = ProcessOutcome::Parsed {
                        bytes_consumed,
                        messages_count,
                        skipped_bytes,
                    };

                    return Ok(parsed);
                }
                Err(ParserError::Incomplete) => {
                    // The parser is asking for more bytes rather than rejecting them, so any
                    // remembered parse error is stale and must not be delivered later on.
                    self.status = ProducerStatus::Running;

                    // The last fetch delivered bytes and the parser still needs more of them:
                    // let the caller load again instead of destroying data by dropping bytes.
                    if fetch_info.newly_loaded_bytes > 0 {
                        trace!("not enough bytes to parse a message. More data must be loaded");

                        return Ok(ProcessOutcome::NeedMoreBytes);
                    }

                    trace!("No bytes has been loaded on last fetch, dropping one byte");
                    self.drop_one_byte();
                    skipped_bytes += DROP_STEP;
                }
                Err(ParserError::Eof) => {
                    trace!("EOF reached...no more messages (skipped_bytes={skipped_bytes})");
                    self.status = ProducerStatus::Done;

                    return Ok(ProcessOutcome::Done);
                }
                Err(ParserError::Parse(err_msg)) => {
                    // TODO: This is temporary solution. We need to inform the user each time we
                    // hit the `INITIAL_PARSE_ERROR_LIMIT` and not break the session.
                    // We may need the new item `MessageStreamItem::Skipped(bytes_count)`
                    //
                    // Return early when initial parse calls fail after dropping one megabyte.
                    // This can happen when provided bytes aren't suitable for the select parser.
                    // In such case we close the session directly to avoid having unresponsive
                    // state while parse is calling on each dropped byte in the source.
                    if !self.did_produce_items() && self.total_dropped > INITIAL_PARSE_ERROR_LIMIT {
                        let abort_msg = format!(
                            "Aborting session due to failing initial parse call with the error: {err_msg}"
                        );
                        warn!("{abort_msg}");

                        self.status = ProducerStatus::Done;

                        return Err(ProcessError::Unrecoverable(abort_msg));
                    }

                    trace!("No parse possible, skip one byte and retry. Error: {err_msg}");
                    // Remember the error: it must be delivered when the source runs dry.
                    self.status = ProducerStatus::ParserErrored { msg: err_msg };
                    self.drop_one_byte();
                    skipped_bytes += DROP_STEP;
                }
                Err(ParserError::Unrecoverable(err)) => {
                    error!("Parsing failed: Error {err}");
                    self.status = ProducerStatus::Done;

                    return Err(ProcessError::Unrecoverable(err));
                }
            }
        }
    }

    /// Resolves the outcome of [`Self::process()`] when the byte source holds no bytes,
    /// delivering a parse error that couldn't be surfaced while resyncing, if any.
    ///
    /// `newly_loaded_bytes` is the count from the [`FetchInfo`] that preceded this call.
    fn on_empty_buffer(
        &mut self,
        newly_loaded_bytes: usize,
    ) -> Result<ProcessOutcome, ProcessError> {
        trace!("No more bytes available from source");

        match std::mem::take(&mut self.status) {
            ProducerStatus::Running => Ok(ProcessOutcome::NoData),
            ProducerStatus::ParserErrored { msg } if newly_loaded_bytes > 0 => {
                // The source is still delivering: keep the error pending and give resyncing
                // another chance with freshly loaded bytes.
                self.status = ProducerStatus::ParserErrored { msg };

                Ok(ProcessOutcome::NeedMoreBytes)
            }
            ProducerStatus::ParserErrored { msg } => {
                trace!("Return the last parse error as no bytes are available anymore");

                Err(ProcessError::Parse(msg))
            }
            ProducerStatus::Done => {
                unreachable!("process() returns before reaching an empty buffer while done")
            }
        }
    }

    /// Drops [`DROP_STEP`] bytes from the bytes available in the byte source, counting them as
    /// skipped, in order to resync the parser on the remaining bytes.
    fn drop_one_byte(&mut self) {
        self.byte_source.consume(DROP_STEP);
        self.total_skipped += DROP_STEP;
        self.total_dropped += DROP_STEP;

        trace!(
            "Dropped {DROP_STEP} byte while resyncing, {} bytes remaining",
            self.byte_source.len()
        );
    }

    /// Loads the next segment of bytes, parses them, and append them to the provided
    /// [`LogRecordsCollector`].
    ///
    /// This is a convenience wrapper around [`Self::fetch()`] and [`Self::process()`] for
    /// callers that don't need to interleave other work between the two steps.
    ///
    /// # Cancel Safety:
    /// Cancel safe by construction: the only await points are [`Self::fetch()`] calls, and
    /// every effect of a [`Self::process()`] call is committed to the producer, the byte source
    /// and the collector before the next await.
    ///
    /// # Return:
    /// Summary of producer state with infos about consumed, skipped bytes and produced log
    /// messages, otherwise it'll return a producer error.
    pub async fn produce_next<C: LogRecordsCollector<P::Output>>(
        &mut self,
        collector: &mut C,
    ) -> Result<ProduceSummary, ProduceError> {
        if self.is_done() {
            debug!("done...no next segment");

            return Ok(self.final_report());
        }

        let mut skipped_bytes = 0;

        loop {
            let fetch_info = self.fetch().await?;
            skipped_bytes += fetch_info.skipped_bytes;

            match self.process(fetch_info, collector)? {
                ProcessOutcome::Parsed {
                    bytes_consumed,
                    messages_count,
                    skipped_bytes: parse_skipped,
                } => {
                    let summary = ProduceSummary::Processed {
                        bytes_consumed,
                        messages_count,
                        skipped_bytes: skipped_bytes + parse_skipped,
                    };
                    return Ok(summary);
                }
                ProcessOutcome::NeedMoreBytes => continue,
                ProcessOutcome::NoData => {
                    return Ok(ProduceSummary::NoBytesAvailable { skipped_bytes });
                }
                ProcessOutcome::Done => return Ok(self.final_report()),
            }
        }
    }

    /// Checks if the producer have already produced any parsed items in the current session.
    #[inline]
    fn did_produce_items(&self) -> bool {
        self.total_messages > 0
    }

    /// Returns [`ProduceSummary::Done`] with summary for producer session.
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
