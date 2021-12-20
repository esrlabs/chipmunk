use crate::Error as SourceError;
use crate::LogMessage;
use crate::MessageStreamItem;
use crate::Parser;
use crate::SourceFilter;
use crate::{ByteSource, ReloadInfo};
use log::{trace, warn};
use std::marker::PhantomData;

pub struct MessageProducer<T, P, S>
where
    T: LogMessage,
    P: Parser<T>,
    S: ByteSource,
{
    byte_source: S,
    index: usize,
    parser: P,
    filter: Option<SourceFilter>,
    _phantom_data: Option<PhantomData<T>>,
}

impl<T: LogMessage, P: Parser<T>, S: ByteSource> MessageProducer<T, P, S> {
    /// create a new producer by plugging into a byte source
    pub fn new(parser: P, source: S) -> Self {
        MessageProducer {
            byte_source: source,
            index: 0,
            parser,
            filter: None,
            _phantom_data: None,
        }
    }

    fn read_next_segment(&mut self) -> Option<(usize, MessageStreamItem<T>)> {
        self.index += 1;
        // 1. buffer loaded? if not, fill buffer with frame data
        // 2. try to parse message from buffer
        // 3a. if message, pop it of the buffer and deliever
        // 3b. else reload into buffer and goto 2
        let mut ts: Option<u64> = None;
        if self.byte_source.is_empty() {
            let (_, last_known_ts) = self.do_reload()?;
            ts = last_known_ts;
        }
        let mut available = self.byte_source.len();
        loop {
            if available == 0 {
                trace!("No more bytes available from source");
                return Some((0, MessageStreamItem::Done));
            }
            match self.parser.parse(self.byte_source.current_slice(), ts) {
                Ok((rest, Some(m))) => {
                    let consumed = available - rest.len();
                    trace!("Extracted a valid message, consumed {} bytes", consumed);
                    self.byte_source.consume(consumed);
                    return Some((consumed, MessageStreamItem::Item(m)));
                }
                Ok((rest, None)) => {
                    let consumed = available - rest.len();
                    self.byte_source.consume(consumed);
                    return Some((consumed, MessageStreamItem::Skipped));
                }
                Err(SourceError::Incomplete) => {
                    trace!("not enough bytes to parse a message");
                    let (loaded_bytes, last_known_ts) = self.do_reload()?;
                    available += loaded_bytes;
                    ts = last_known_ts;
                    continue;
                }
                Err(SourceError::Eof) => {
                    trace!("EOF reached...no more messages");
                    return None;
                }
                Err(SourceError::Parse(s)) => {
                    trace!("No parse possible, try next batch of data ({})", s);
                    self.byte_source.consume(available);
                    available = self.byte_source.len();

                    let (loaded_bytes, last_known_ts) = self.do_reload()?;
                    available += loaded_bytes;
                    ts = last_known_ts;
                }
                Err(e) => {
                    trace!("Error during parsing, cannot continue: {}", e);
                    return None;
                }
            }
        }
    }

    fn do_reload(&mut self) -> Option<(usize, Option<u64>)> {
        match self.byte_source.reload(self.filter.as_ref()) {
            Ok(Some(ReloadInfo {
                loaded_bytes,
                last_known_ts,
            })) => Some((loaded_bytes, last_known_ts)),
            Ok(None) => None,
            Err(e) => {
                warn!("Error reloading content: {}", e);
                None
            }
        }
    }
}

impl<T: LogMessage, P: Parser<T>, S: ByteSource> std::iter::Iterator for MessageProducer<T, P, S> {
    type Item = (usize, MessageStreamItem<T>);
    fn next(&mut self) -> Option<Self::Item> {
        self.read_next_segment()
    }
}
