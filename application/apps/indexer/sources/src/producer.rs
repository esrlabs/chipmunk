#[cfg(test)]
mod tests;

use definitions::Parser;
use definitions::*;
use log::warn;

/// Number of bytes to skip on initial parse errors before terminating the session.
const INITIAL_PARSE_ERROR_LIMIT: usize = 1024;

#[derive(Debug)]
pub struct MessageProducer<P, D, W>
where
    P: Parser,
    D: ByteSource,
    W: LogRecordWriter,
{
    byte_source: D,
    parser: P,
    filter: Option<SourceFilter>,
    last_seen_ts: Option<u64>,
    total_loaded: usize,
    total_skipped: usize,
    done: bool,
    buffer: Vec<(usize, MessageStreamItem)>,
    writer: W,
}

impl<P: Parser, D: ByteSource, W: LogRecordWriter> MessageProducer<P, D, W> {
    /// create a new producer by plugging into a byte source
    pub fn new(parser: P, source: D, writer: W) -> Self {
        MessageProducer {
            byte_source: source,
            parser,
            filter: None,
            last_seen_ts: None,
            total_loaded: 0,
            total_skipped: 0,
            done: false,
            buffer: Vec::new(),
            writer,
        }
    }

    /// Loads the next segment of bytes, parses them, and returns the items in a mutable vector.
    /// The caller can choose whether to consume the items or not.
    ///
    /// # Cancel Safety:
    /// This function is cancel safe as long [`ByteSource::load()`] method on used byte source is
    /// safe as well.
    ///
    /// # Return:
    /// Return a mutable reference for the newly parsed items when there are more data available,
    /// otherwise it returns None when there are no more data available in the source.
    pub async fn read_next_segment(&mut self) -> Option<(usize, MessageStreamItem)> {
        // ### Cancel Safety ###:
        // This function is cancel safe because:
        // * there is no await calls or any function causing yielding between filling the internal
        //   buffer and returning it.
        // * Byte source will keep the loaded data in its internal buffer ensuring there
        //   is no data loss when cancelling happen between load calls.

        self.buffer.clear();

        if self.done {
            debug!("done...no next segment");
            return None;
        }
        let (_newly_loaded, mut available, mut skipped_bytes) =
            self.load().await.unwrap_or((0, 0, 0));

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
                if let Err(err) = self.writer.finalize() {
                    error!("Fail to write data into writer: {err}");
                }
                return Some((0, MessageStreamItem::Done));
            }

            // we can call consume only after all parse results are collected because of its
            // reference to self.
            match self
                .parser
                .iter(self.byte_source.current_slice(), self.last_seen_ts)
            {
                Ok(mut iterator) => {
                    let mut bytes_processed = 0;
                    let mut messages_received = 0;
                    while let Some((consumed, msg)) = iterator.next() {
                        bytes_processed += consumed;
                        if let Some(msg) = msg {
                            if let Err(err) = self.writer.write(msg) {
                                error!("Fail to write data into writer: {err}");
                                return None;
                            }
                            messages_received += 1;
                        } else {
                            self.byte_source.consume(bytes_processed);
                            if let Err(err) = self.writer.finalize() {
                                error!("Fail to write data into writer: {err}");
                            }
                            return None;
                        }
                    }
                    self.byte_source.consume(bytes_processed);
                    return Some((
                        bytes_processed,
                        MessageStreamItem::Parsed(ParseOperationResult::new(
                            bytes_processed,
                            messages_received,
                        )),
                    ));
                }
                Err(ParserError::Incomplete) => {
                    trace!("not enough bytes to parse a message. Load more data");
                    let (newly_loaded, _available_bytes, skipped) = self.load().await?;

                    if newly_loaded > 0 {
                        trace!("New bytes has been loaded, trying parsing again.");
                        available += newly_loaded;
                        skipped_bytes += skipped;
                    } else {
                        trace!("No bytes has been loaded, drop one byte if available or load");

                        if !self.drop_and_load(&mut available, &mut skipped_bytes).await {
                            trace!(
                                "Terminating the session with no available bytes after drop and load"
                            );
                            let unused = skipped_bytes + available;
                            self.done = true;
                            if let Err(err) = self.writer.finalize() {
                                error!("Fail to write data into writer: {err}");
                            }
                            return Some((unused, MessageStreamItem::Done));
                        }
                    }
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
                    // TODO: This is temporary solution. We need to inform the user each time we
                    // hit the `INITIAL_PARSE_ERROR_LIMIT` and not break the session.
                    // We may need the new item `MessageStreamItem::Skipped(bytes_count)`
                    //
                    // Return early when initial parse calls fail after consuming one megabyte.
                    // This can happen when provided bytes aren't suitable for the select parser.
                    // In such case we close the session directly to avoid having unresponsive
                    // state while parse is calling on each skipped byte in the source.
                    if !self.did_produce_items() && skipped_bytes > INITIAL_PARSE_ERROR_LIMIT {
                        warn!(
                            "Aborting session due to failing initial parse call with the error: {s}"
                        );
                        let unused = skipped_bytes + available;
                        self.done = true;
                        if let Err(err) = self.writer.finalize() {
                            error!("Fail to write data into writer: {err}");
                        }
                        return Some((unused, MessageStreamItem::Done));
                    }

                    trace!("No parse possible, skip one byte and retry. Error: {s}");
                    if self.drop_and_load(&mut available, &mut skipped_bytes).await {
                        continue;
                    } else {
                        trace!(
                            "Terminating the session with no available bytes after drop and load"
                        );
                        let unused = skipped_bytes + available;
                        self.done = true;
                        if let Err(err) = self.writer.finalize() {
                            error!("Fail to write data into writer: {err}");
                        }
                        return Some((unused, MessageStreamItem::Done));
                    }
                }
                Err(ParserError::Unrecoverable(err)) => {
                    //TODO: Errors like this must be visible to users.
                    // Current producer loop swallows the errors after logging them,
                    // returning that the session is ended after encountering such errors.
                    error!("Parsing failed: Error {err}");
                    eprintln!("Parsing failed: Error: {err}");
                    self.done = true;
                    if let Err(err) = self.writer.finalize() {
                        error!("Fail to write data into writer: {err}");
                    }
                    return Some((0, MessageStreamItem::Done));
                }
                Err(ParserError::Native(err)) => {
                    todo!("Not Implemented")
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

    /// Drops one byte from the available bytes and loads more bytes if no more bytes are
    /// available.
    ///
    /// # Note:
    /// This function is intended for internal use in producer loop only.
    ///
    /// # Return:
    /// `true` when there are available bytes to be parsed, otherwise it'll return `false`
    /// indicating that the session should be terminated.
    async fn drop_and_load(&mut self, available: &mut usize, skipped_bytes: &mut usize) -> bool {
        if *available > 0 {
            trace!("Dropping one byte from loaded ones.");
            const DROP_STEP: usize = 1;
            *available -= DROP_STEP;
            *skipped_bytes += DROP_STEP;
            self.byte_source.consume(DROP_STEP);

            // we still have bytes -> call parse on the remaining bytes without loading.
            if *available > 0 {
                return true;
            }
        }

        // Load more bytes.
        trace!("No more bytes are available. Loading more bytes");
        match self.load().await {
            Some((newly_loaded, _available_bytes, skipped)) => {
                *available += newly_loaded;
                *skipped_bytes += skipped;

                newly_loaded > 0
            }
            None => false,
        }
    }

    /// Checks if the producer have already produced any parsed items in the current session.
    fn did_produce_items(&self) -> bool {
        // Produced items will be added to the internal buffer increasing its capacity.
        // This isn't straight forward way, but used to avoid having to introduce a new field
        // and keep track on its state.
        self.buffer.capacity() > 0
    }

    /// Append incoming (SDE) Source-Data-Exchange to the underline byte source data.
    pub async fn sde_income(
        &mut self,
        msg: stypes::SdeRequest,
    ) -> Result<stypes::SdeResponse, SourceError> {
        self.byte_source.income(msg).await
    }
}
