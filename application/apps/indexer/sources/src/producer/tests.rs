mod mock_byte_source;
mod mock_parser;

use futures::{pin_mut, StreamExt};
use parsers::{Error as ParseError, ParseYield};
use tests::mock_parser::*;

use crate::{
    producer::tests::mock_byte_source::{MockByteSource, MockReloadSeed},
    Error,
};

use super::*;

#[tokio::test]
async fn empty_byte_source() {
    let parser = MockParser::new([]);
    let source = MockByteSource::new(0, [Ok(None)]);

    let mut producer = MessageProducer::new(parser, source, None);

    let stream = producer.as_stream();
    pin_mut!(stream);

    let next = stream.next().await;
    assert!(matches!(next, Some((0, MessageStreamItem::Done))));

    let next = stream.next().await;
    assert!(next.is_none());
}

#[tokio::test]
async fn byte_source_fail() {
    let parser = MockParser::new([]);
    let source = MockByteSource::new(0, [Err(Error::NotSupported)]);

    let mut producer = MessageProducer::new(parser, source, None);

    let stream = producer.as_stream();
    pin_mut!(stream);

    // Done message should be sent
    let next = stream.next().await;
    assert!(matches!(next, Some((0, MessageStreamItem::Done))));

    // Then the stream should be closed
    let next = stream.next().await;
    assert!(next.is_none());
}

#[tokio::test]
async fn parse_item_then_skip() {
    let parser = MockParser::new([
        Ok(MockParseSeed::new(
            5,
            Some(ParseYield::Message(MockMessage::from(1))),
        )),
        Ok(MockParseSeed::new(5, None)),
    ]);
    let source = MockByteSource::new(
        0,
        [
            Ok(Some(MockReloadSeed::new(10, 0))),
            Ok(Some(MockReloadSeed::new(0, 0))),
            Ok(None),
        ],
    );

    let mut producer = MessageProducer::new(parser, source, None);

    let stream = producer.as_stream();
    pin_mut!(stream);

    // First message should be message with content
    let next = stream.next().await;
    assert!(matches!(
        next,
        Some((
            5,
            MessageStreamItem::Item(ParseYield::Message(MockMessage { content: 1 }))
        ))
    ));

    // Skipped message when Praser is returning None
    let next = stream.next().await;
    assert!(matches!(next, Some((5, MessageStreamItem::Skipped))));

    // Done message should be sent
    let next = stream.next().await;
    assert!(matches!(next, Some((0, MessageStreamItem::Done))));

    // Then the stream should be closed
    let next = stream.next().await;
    assert!(next.is_none());
}

#[tokio::test]
async fn parse_incomplete() {
    let parser = MockParser::new([
        Err(ParseError::Incomplete),
        Err(ParseError::Incomplete),
        Ok(MockParseSeed::new(
            5,
            Some(ParseYield::Message(MockMessage::from(1))),
        )),
    ]);
    let source = MockByteSource::new(
        0,
        [
            Ok(Some(MockReloadSeed::new(10, 0))),
            Ok(Some(MockReloadSeed::new(10, 0))),
            Ok(Some(MockReloadSeed::new(0, 0))),
            Ok(None),
        ],
    );

    let mut producer = MessageProducer::new(parser, source, None);

    let stream = producer.as_stream();
    pin_mut!(stream);

    // First message should be message with content
    let next = stream.next().await;
    assert!(matches!(
        next,
        Some((
            5,
            MessageStreamItem::Item(ParseYield::Message(MockMessage { content: 1 }))
        ))
    ));

    // Done message should be sent
    let next = stream.next().await;
    assert!(matches!(next, Some((0, MessageStreamItem::Done))));

    // Then the stream should be closed
    let next = stream.next().await;
    assert!(next.is_none());
}

#[tokio::test]
async fn parse_incomplete_with_err_reload() {
    let parser = MockParser::new([Err(ParseError::Incomplete)]);
    let source = MockByteSource::new(
        0,
        [
            Ok(Some(MockReloadSeed::new(10, 0))),
            Err(Error::NotSupported),
        ],
    );

    let mut producer = MessageProducer::new(parser, source, None);

    let stream = producer.as_stream();
    pin_mut!(stream);

    // Stream should be closed directly if reload failed after parser returning Incomplete error
    let next = stream.next().await;
    assert!(next.is_none());
}

#[tokio::test]
async fn parse_err_eof() {
    let parser = MockParser::new([Err(ParseError::Eof)]);
    let source = MockByteSource::new(0, [Ok(Some(MockReloadSeed::new(10, 0)))]);

    let mut producer = MessageProducer::new(parser, source, None);

    let stream = producer.as_stream();
    pin_mut!(stream);

    // Stream should be closed directly if parse returns `Error::Eof`
    let next = stream.next().await;
    assert!(next.is_none());
}

#[tokio::test]
async fn parsing_error_success_reload() {
    let parser = MockParser::new([
        Err(ParseError::Parse(Default::default())),
        Ok(MockParseSeed::new(
            5,
            Some(ParseYield::Message(MockMessage::from(1))),
        )),
    ]);

    let source = MockByteSource::new(
        0,
        [
            Ok(Some(MockReloadSeed::new(10, 0))),
            Ok(Some(MockReloadSeed::new(10, 0))),
            Ok(None),
        ],
    );

    let mut producer = MessageProducer::new(parser, source, None);

    let stream = producer.as_stream();
    pin_mut!(stream);

    // Message with content should be yielded
    let next = stream.next().await;
    assert!(matches!(
        next,
        Some((
            15,
            MessageStreamItem::Item(ParseYield::Message(MockMessage { content: 1 }))
        ))
    ));

    // Done message should be sent
    let next = stream.next().await;
    assert!(matches!(next, Some((0, MessageStreamItem::Done))));

    // Then the stream should be closed
    let next = stream.next().await;
    assert!(next.is_none());
}

#[tokio::test]
async fn parsing_error_then_fail_reload() {
    let parser = MockParser::new([
        Err(ParseError::Parse(Default::default())),
        Ok(MockParseSeed::new(
            5,
            Some(ParseYield::Message(MockMessage::from(1))),
        )),
    ]);

    let source = MockByteSource::new(0, [Ok(Some(MockReloadSeed::new(10, 0))), Ok(None)]);

    let mut producer = MessageProducer::new(parser, source, None);

    let stream = producer.as_stream();
    pin_mut!(stream);

    // Done message should be sent with unused bytes.
    let next = stream.next().await;
    assert!(matches!(next, Some((10, MessageStreamItem::Done))));

    // Then the stream should be closed
    let next = stream.next().await;
    assert!(next.is_none());
}

#[tokio::test]
async fn parse_with_skipped_bytes() {
    let parser = MockParser::new([
        Ok(MockParseSeed::new(
            3,
            Some(ParseYield::Message(MockMessage::from(1))),
        )),
        Ok(MockParseSeed::new(2, None)),
    ]);

    let source = MockByteSource::new(
        0,
        [
            Ok(Some(MockReloadSeed::new(10, 4))),
            Ok(Some(MockReloadSeed::new(10, 4))),
            Ok(None),
        ],
    );

    let mut producer = MessageProducer::new(parser, source, None);

    let stream = producer.as_stream();
    pin_mut!(stream);

    // Message with content 1 should be yielded considering skipped bytes
    let next = stream.next().await;
    assert!(matches!(
        next,
        Some((
            7, // 7: 3 consumed + 4 skipped
            MessageStreamItem::Item(ParseYield::Message(MockMessage { content: 1 }))
        ))
    ));

    // Skipped Message should be yielded considering skipped bytes
    let next = stream.next().await;
    assert!(matches!(
        next,
        Some((
            6, // 6: 2 consumed + 4 skipped
            MessageStreamItem::Skipped
        ))
    ));

    // Done message should be sent.
    let next = stream.next().await;
    assert!(matches!(next, Some((0, MessageStreamItem::Done))));

    // Then the stream should be closed
    let next = stream.next().await;
    assert!(next.is_none());
}

#[tokio::test]
async fn parsing_error_then_fail_reload_with_skipped_bytes() {
    let parser = MockParser::new([
        Err(ParseError::Parse(Default::default())),
        Ok(MockParseSeed::new(
            5,
            Some(ParseYield::Message(MockMessage::from(1))),
        )),
    ]);

    let source = MockByteSource::new(0, [Ok(Some(MockReloadSeed::new(10, 3))), Ok(None)]);

    let mut producer = MessageProducer::new(parser, source, None);

    let stream = producer.as_stream();
    pin_mut!(stream);

    // Done message should be sent with unused bytes, considering the skipped bytes.
    let next = stream.next().await;
    assert!(matches!(next, Some((13, MessageStreamItem::Done))));

    // Then the stream should be closed
    let next = stream.next().await;
    assert!(next.is_none());
}

#[tokio::test]
async fn parsing_error_success_reload_with_skipped_bytes() {
    let parser = MockParser::new([
        Err(ParseError::Parse(Default::default())),
        Ok(MockParseSeed::new(
            5,
            Some(ParseYield::Message(MockMessage::from(1))),
        )),
    ]);

    let source = MockByteSource::new(
        0,
        [
            Ok(Some(MockReloadSeed::new(10, 4))),
            Ok(Some(MockReloadSeed::new(10, 4))),
            Ok(None),
        ],
    );

    let mut producer = MessageProducer::new(parser, source, None);

    let stream = producer.as_stream();
    pin_mut!(stream);

    // Message with content should be yielded considering the skipped bytes on both reload calls
    let next = stream.next().await;
    assert!(matches!(
        next,
        Some((
            23, // 23: 5 consumed + 10 skipped from Error::Parse match branch + (4 + 4) skipped
            MessageStreamItem::Item(ParseYield::Message(MockMessage { content: 1 }))
        ))
    ));

    // Done message should be sent
    let next = stream.next().await;
    assert!(matches!(next, Some((0, MessageStreamItem::Done))));

    // Then the stream should be closed
    let next = stream.next().await;
    assert!(next.is_none());
}
