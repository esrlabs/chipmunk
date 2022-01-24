use crate::{ByteSource, ReloadInfo, SourceFilter};
use async_stream::stream;
use parsers::{Error as ParserError, MessageStreamItem, Parser};
use std::marker::PhantomData;
use tokio_stream::Stream;

pub struct MessageProducer<T, P, S>
where
    T: Send,
    P: Parser<T>,
    S: ByteSource,
{
    byte_source: S,
    index: usize,
    parser: P,
    filter: Option<SourceFilter>,
    last_seen_ts: Option<u64>,
    _phantom_data: Option<PhantomData<T>>,
    total_loaded: usize,
    total_skipped: usize,
}
// impl<T: std::marker::Unpin + Send, P: Parser<T>, S: ByteSource> Iterator
//     for MessageProducer<T, P, S>
// {
//     type Item = (usize, MessageStreamItem<T>);
//     fn next(&mut self) -> std::option::Option<(usize, parsers::MessageStreamItem<T>)> {
//         self.read_next_segment()
//     }
// }

impl<T: std::marker::Unpin + Send, P: Parser<T>, S: ByteSource> MessageProducer<T, P, S> {
    /// create a new producer by plugging into a byte source
    pub fn new(parser: P, source: S) -> Self {
        MessageProducer {
            byte_source: source,
            index: 0,
            parser,
            filter: None,
            last_seen_ts: None,
            _phantom_data: None,
            total_loaded: 0,
            total_skipped: 0,
        }
    }
    /// create a stream of pairs that contain the count of all consumed bytes and the
    /// MessageStreamItem
    pub fn as_stream(&mut self) -> impl Stream<Item = (usize, MessageStreamItem<T>)> + '_ {
        stream! {
            while let Some(item) = self.read_next_segment().await {
                yield item;
            }
        }
    }

    async fn read_next_segment(&mut self) -> Option<(usize, MessageStreamItem<T>)> {
        self.index += 1;
        // 1. buffer loaded? if not, fill buffer with frame data
        // 2. try to parse message from buffer
        // 3a. if message, pop it of the buffer and deliever
        // 3b. else reload into buffer and goto 2
        let (mut available, mut skipped_bytes) = self.do_reload().await?;
        loop {
            if available == 0 {
                trace!("No more bytes available from source");
                return Some((0, MessageStreamItem::Done));
            }
            match self
                .parser
                .parse(self.byte_source.current_slice(), self.last_seen_ts)
            {
                Ok((rest, Some(m))) => {
                    let consumed = available - rest.len();
                    let total_used_bytes = consumed + skipped_bytes;
                    trace!(
                        "Extracted a valid message, consumed {} bytes (total used {} bytes)",
                        consumed,
                        total_used_bytes
                    );
                    self.byte_source.consume(consumed);
                    return Some((total_used_bytes, MessageStreamItem::Item(m)));
                }
                Ok((rest, None)) => {
                    let consumed = available - rest.len();
                    self.byte_source.consume(consumed);
                    trace!("None, consumed {} bytes", consumed);
                    let total_used_bytes = consumed + skipped_bytes;
                    return Some((total_used_bytes, MessageStreamItem::Skipped));
                }
                Err(ParserError::Incomplete) => {
                    trace!("not enough bytes to parse a message");
                    let (reloaded, skipped) = self.do_reload().await?;
                    available += reloaded;
                    skipped_bytes += skipped;
                    continue;
                }
                Err(ParserError::Eof) => {
                    trace!(
                        "EOF reached...no more messages (skipped_bytes={})",
                        skipped_bytes
                    );
                    return None;
                }
                Err(ParserError::Parse(s)) => {
                    warn!(
                        "No parse possible, try next batch of data ({}), skipped {} more bytes ({} already)",
                        s, available, skipped_bytes
                    );
                    self.byte_source.consume(available);
                    skipped_bytes += available;
                    available = self.byte_source.len();
                    if let Some((reloaded, skipped)) = self.do_reload().await {
                        available += reloaded;
                        skipped_bytes += skipped;
                    } else {
                        let unused = skipped_bytes + available;
                        return Some((unused, MessageStreamItem::Done));
                    }
                }
            }
        }
    }

    async fn do_reload(&mut self) -> Option<(usize, usize)> {
        match self.byte_source.reload(self.filter.as_ref()).await {
            Ok(Some(ReloadInfo {
                loaded_bytes,
                skipped_bytes,
                last_known_ts,
            })) => {
                self.total_loaded += loaded_bytes;
                self.total_skipped += skipped_bytes;
                if let Some(ts) = last_known_ts {
                    self.last_seen_ts = Some(ts);
                }
                trace!(
                    "did a do_reload, skipped {} bytes, loaded {} bytes (total loaded and skipped: {})",
                    skipped_bytes, loaded_bytes, self.total_loaded + self.total_skipped
                );
                Some((loaded_bytes, skipped_bytes))
            }
            Ok(None) => None,
            Err(e) => {
                warn!("Error reloading content: {}", e);
                None
            }
        }
    }
}

// impl<T: LogMessage, P: Parser<T>, S: ByteSource> std::iter::Iterator for MessageProducer<T, P, S> {
// impl<T: LogMessage, P: Parser<T>, S: ByteSource> Stream for MessageProducer<T, P, S> {
//     // type Item = (usize, MessageStreamItem<T>);
//     type Item = (usize, Option<MessageStreamItem<T>>);
//     fn poll_next(
//         mut self: std::pin::Pin<&mut Self>,
//         _cx: &mut std::task::Context,
//     ) -> core::task::Poll<Option<Self::Item>> {
//         // fn next(&mut self) -> Option<Self::Item> {
//         self.read_next_segment()
//     }
// }
