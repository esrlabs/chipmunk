use crate::ByteSource;
use crate::Error as SourceError;
use crate::LogMessage;
use crate::MessageStreamItem;
use crate::Parser;
use crate::SourceFilter;
use log::trace;
use std::marker::PhantomData;
use std::time::SystemTime;
use std::time::UNIX_EPOCH;

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
    /// create a new producer by plugging into a pcapng file
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
        let now = SystemTime::now();

        let since_the_epoch = now
            .duration_since(UNIX_EPOCH)
            .unwrap_or_else(|_| std::time::Duration::from_secs(0));
        let last_in_ms = since_the_epoch.as_millis() as i64;
        // 1. buffer loaded? if not, fill buffer with frame data
        // 2. try to parse message from buffer
        // 3a. if message, pop it of the buffer and deliever
        // 3b. else reload into buffer and goto 2
        if self.byte_source.is_empty() {
            self.byte_source
                .reload(self.filter.as_ref())
                .ok()
                .flatten()?;
        }
        let mut available = self.byte_source.len();
        loop {
            if available == 0 {
                trace!("No more bytes available from source");
                return Some((0, MessageStreamItem::Done));
            }
            match self
                .parser
                .parse(self.byte_source.current_slice(), Some(last_in_ms as u64))
            {
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
                    let reload_res = self.byte_source.reload(self.filter.as_ref());
                    match reload_res {
                        Ok(Some(n)) => {
                            available += n;
                            continue;
                        }
                        Ok(None) => return None,
                        Err(e) => {
                            trace!("Error reloading content: {}", e);
                            return None;
                        }
                    }
                }
                Err(SourceError::Eof) => {
                    trace!("EOF reached...no more messages");
                    return None;
                }
                Err(SourceError::Parse(s)) => {
                    trace!("No parse possible, try next batch of data ({})", s);
                    self.byte_source.consume(available);
                    available = self.byte_source.len();
                    let reload_res = self.byte_source.reload(self.filter.as_ref());
                    match reload_res {
                        Ok(Some(n)) => {
                            available += n;
                            continue;
                        }
                        Ok(None) => return None,
                        Err(e) => {
                            trace!("Error reloading content: {}", e);
                            return None;
                        }
                    }
                }
                Err(e) => {
                    trace!("Error during parsing, cannot continue: {}", e);
                    return None;
                }
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
