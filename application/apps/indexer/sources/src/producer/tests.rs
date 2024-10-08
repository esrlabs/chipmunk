mod mock_byte_source;
mod mock_parser;

use std::time::Duration;

use futures::{pin_mut, StreamExt};
use parsers::{Error as ParseError, ParseYield};
use tests::mock_parser::*;
use tokio::sync::{mpsc::unbounded_channel, oneshot};

use crate::{
    producer::tests::mock_byte_source::{MockByteSource, MockReloadSeed},
    sde::SdeRequest,
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

    let next = stream.next().await.unwrap();
    assert_eq!(next.len(), 1);
    assert!(matches!(next[0], (0, MessageStreamItem::Done)));

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
    let next = stream.next().await.unwrap();
    assert_eq!(next.len(), 1);
    assert!(matches!(next[0], (0, MessageStreamItem::Done)));

    // Then the stream should be closed
    let next = stream.next().await;
    assert!(next.is_none());
}

#[tokio::test]
async fn parse_item_then_skip() {
    let parser = MockParser::new([
        Ok(vec![MockParseSeed::new(
            5,
            Some(ParseYield::Message(MockMessage::from(1))),
        )]),
        Ok(vec![MockParseSeed::new(5, None)]),
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

    // First results should be one message with content
    let next = stream.next().await.unwrap();
    assert_eq!(next.len(), 1);
    assert!(matches!(
        next[0],
        (
            5,
            MessageStreamItem::Item(ParseYield::Message(MockMessage { content: 1 }))
        )
    ));

    // Skipped message when Parser is returning None
    let next = stream.next().await.unwrap();
    assert_eq!(next.len(), 1);
    assert!(matches!(next[0], (5, MessageStreamItem::Skipped)));

    // Done message should be sent
    let next = stream.next().await.unwrap();
    assert_eq!(next.len(), 1);
    assert!(matches!(next[0], (0, MessageStreamItem::Done)));

    // Then the stream should be closed
    let next = stream.next().await;
    assert!(next.is_none());
}

#[tokio::test]
async fn parse_incomplete() {
    let parser = MockParser::new([
        Err(ParseError::Incomplete),
        Err(ParseError::Incomplete),
        Ok(vec![MockParseSeed::new(
            5,
            Some(ParseYield::Message(MockMessage::from(1))),
        )]),
        Ok(vec![MockParseSeed::new(
            25,
            Some(ParseYield::Message(MockMessage::from(1))),
        )]),
    ]);
    let source = MockByteSource::new(
        0,
        [
            Ok(Some(MockReloadSeed::new(10, 0))),
            Ok(Some(MockReloadSeed::new(10, 0))),
            Ok(Some(MockReloadSeed::new(10, 0))),
            Ok(None),
            Ok(None),
        ],
    );

    let mut producer = MessageProducer::new(parser, source, None);

    let stream = producer.as_stream();
    pin_mut!(stream);

    // First message should be message with content
    let next = stream.next().await.unwrap();
    assert_eq!(next.len(), 1);
    assert!(matches!(
        next[0],
        (
            5,
            MessageStreamItem::Item(ParseYield::Message(MockMessage { content: 1 }))
        )
    ));

    // Second message consumes all the remaining bytes.
    let next = stream.next().await.unwrap();
    assert_eq!(next.len(), 1);
    assert!(matches!(
        next[0],
        (
            25,
            MessageStreamItem::Item(ParseYield::Message(MockMessage { content: 1 }))
        )
    ));

    // Done message should be sent
    let next = stream.next().await.unwrap();
    assert_eq!(next.len(), 1);
    assert!(matches!(next[0], (0, MessageStreamItem::Done)));

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
        Ok(vec![MockParseSeed::new(
            10,
            Some(ParseYield::Message(MockMessage::from(1))),
        )]),
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

    // Message with content should be yielded consuming all the bytes.
    let next = stream.next().await.unwrap();
    assert_eq!(next.len(), 1);
    assert!(matches!(
        next[0],
        (
            20,
            MessageStreamItem::Item(ParseYield::Message(MockMessage { content: 1 }))
        )
    ));

    // Done message should be sent
    let next = stream.next().await.unwrap();
    assert_eq!(next.len(), 1);
    assert!(matches!(next[0], (0, MessageStreamItem::Done)));

    // Then the stream should be closed
    let next = stream.next().await;
    assert!(next.is_none());
}

#[tokio::test]
async fn parsing_error_then_fail_reload() {
    let parser = MockParser::new([
        Err(ParseError::Parse(Default::default())),
        Ok(vec![MockParseSeed::new(
            5,
            Some(ParseYield::Message(MockMessage::from(1))),
        )]),
    ]);

    let source = MockByteSource::new(0, [Ok(Some(MockReloadSeed::new(10, 0))), Ok(None)]);

    let mut producer = MessageProducer::new(parser, source, None);

    let stream = producer.as_stream();
    pin_mut!(stream);

    // Done message should be sent with unused bytes.
    let next = stream.next().await.unwrap();
    assert_eq!(next.len(), 1);
    assert!(matches!(next[0], (10, MessageStreamItem::Done)));

    // Then the stream should be closed
    let next = stream.next().await;
    assert!(next.is_none());
}

#[tokio::test]
async fn parse_with_skipped_bytes() {
    let parser = MockParser::new([
        Ok(vec![MockParseSeed::new(
            3,
            Some(ParseYield::Message(MockMessage::from(1))),
        )]),
        Ok(vec![MockParseSeed::new(2, None)]),
        Ok(vec![MockParseSeed::new(15, None)]),
    ]);

    let source = MockByteSource::new(
        0,
        [
            Ok(Some(MockReloadSeed::new(10, 4))),
            Ok(Some(MockReloadSeed::new(10, 4))),
            Ok(None),
            Ok(None),
        ],
    );

    let mut producer = MessageProducer::new(parser, source, None);

    let stream = producer.as_stream();
    pin_mut!(stream);

    // Message with content 1 should be yielded considering skipped bytes
    let next = stream.next().await.unwrap();
    assert_eq!(next.len(), 1);
    assert!(matches!(
        next[0],
        (
            7, // 7: 3 consumed + 4 skipped
            MessageStreamItem::Item(ParseYield::Message(MockMessage { content: 1 }))
        )
    ));

    // Skipped Message should be yielded considering skipped bytes
    let next = stream.next().await.unwrap();
    assert_eq!(next.len(), 1);
    assert!(matches!(
        next[0],
        (
            6, // 6: 2 consumed + 4 skipped
            MessageStreamItem::Skipped
        )
    ));

    // Consume the remaining bytes with successful parse.
    let next = stream.next().await.unwrap();
    assert_eq!(next.len(), 1);
    assert!(matches!(
        next[0],
        (
            15, // 15 consumed + 0 skipped
            MessageStreamItem::Skipped
        )
    ));

    // Done message should be sent.
    let next = stream.next().await.unwrap();
    assert_eq!(next.len(), 1);
    assert!(matches!(next[0], (0, MessageStreamItem::Done)));

    // Then the stream should be closed
    let next = stream.next().await;
    assert!(next.is_none());
}

#[tokio::test]
async fn parsing_error_then_fail_reload_with_skipped_bytes() {
    let parser = MockParser::new([
        Err(ParseError::Parse(Default::default())),
        Ok(vec![MockParseSeed::new(
            5,
            Some(ParseYield::Message(MockMessage::from(1))),
        )]),
    ]);

    let source = MockByteSource::new(0, [Ok(Some(MockReloadSeed::new(10, 3))), Ok(None)]);

    let mut producer = MessageProducer::new(parser, source, None);

    let stream = producer.as_stream();
    pin_mut!(stream);

    // Done message should be sent with unused bytes, considering the skipped bytes.
    let next = stream.next().await.unwrap();
    assert_eq!(next.len(), 1);
    assert!(matches!(next[0], (13, MessageStreamItem::Done)));

    // Then the stream should be closed
    let next = stream.next().await;
    assert!(next.is_none());
}

#[tokio::test]
async fn parsing_error_success_reload_with_skipped_bytes() {
    let parser = MockParser::new([
        Err(ParseError::Parse(Default::default())),
        Ok(vec![MockParseSeed::new(
            5,
            Some(ParseYield::Message(MockMessage::from(1))),
        )]),
        Ok(vec![MockParseSeed::new(
            5,
            Some(ParseYield::Message(MockMessage::from(1))),
        )]),
    ]);

    let source = MockByteSource::new(
        0,
        [
            Ok(Some(MockReloadSeed::new(10, 4))),
            Ok(Some(MockReloadSeed::new(10, 4))),
            Ok(None),
            Ok(None),
        ],
    );

    let mut producer = MessageProducer::new(parser, source, None);

    let stream = producer.as_stream();
    pin_mut!(stream);

    // Message with content should be yielded considering the skipped bytes on both reload calls
    let next = stream.next().await.unwrap();
    assert_eq!(next.len(), 1);
    assert!(matches!(
        next[0],
        (
            23, // 23: 5 consumed + 10 skipped from Error::Parse match branch + (4 + 4) skipped
            MessageStreamItem::Item(ParseYield::Message(MockMessage { content: 1 }))
        )
    ));

    // Message uses all available bytes.
    let next = stream.next().await.unwrap();
    assert_eq!(next.len(), 1);
    assert!(matches!(
        next[0],
        (
            5,
            MessageStreamItem::Item(ParseYield::Message(MockMessage { content: 1 }))
        )
    ));

    // Done message should be sent
    let next = stream.next().await.unwrap();
    assert_eq!(next.len(), 1);
    assert!(matches!(next[0], (0, MessageStreamItem::Done)));

    // Then the stream should be closed
    let next = stream.next().await;
    assert!(next.is_none());
}

#[tokio::test]
/// This function tests the sde SDE Communication in the producer loop
async fn sde_communication() {
    let parser = MockParser::new([Ok(vec![MockParseSeed::new(
        5,
        Some(ParseYield::Message(MockMessage::from(1))),
    )])]);

    // The duration which `reload()` should wait for before delivering the data.
    const SLEEP_DURATION: Duration = Duration::from_millis(50);

    let source = MockByteSource::new(
        0,
        [
            // This value must never be delivered because `reload()` on `MockByteSource`
            // isn't cancel safe, and the value here will be dropped with the `reload()` future
            // within the `select!()` macro in producer loop.
            Ok(Some(
                MockReloadSeed::new(5, 0).sleep_duration(SLEEP_DURATION),
            )),
            // This value should be delivered because the first one must be dropped because of the
            // cancel safety issue
            Ok(Some(MockReloadSeed::new(10, 0))),
        ],
    );

    // Create producer with sde channels
    let (tx_sde, rx_sde) = unbounded_channel();
    let mut producer = MessageProducer::new(parser, source, Some(rx_sde));

    let stream = producer.as_stream();
    pin_mut!(stream);

    // Send message to sde receiver before calling next.
    let (tx_sde_response, mut rx_sde_response) = oneshot::channel();
    const SDE_TEXT: &str = "sde_msg";
    tx_sde
        .send((
            SdeRequest::WriteText(String::from(SDE_TEXT)),
            tx_sde_response,
        ))
        .unwrap();

    // The first source seed has a delay and won't be picked in the `select!` macro in the producer
    // loop, and it will be dropped because `reload()` in `MockByteSource` isn't cancel safe.
    let next = stream.next().await.unwrap();
    assert_eq!(next.len(), 1);
    assert!(matches!(
        next[0],
        (
            5,
            MessageStreamItem::Item(ParseYield::Message(MockMessage { content: 1 }))
        )
    ));

    // Producer loop must have called `income()` and sent the message by now.
    // The bytes length must match the sent message length as it implemented and tested in `MockByteSource`
    let sde_response_res = rx_sde_response
        .try_recv()
        .expect("Sde Response must be sent by now because of the delay");

    let sde_response =
        sde_response_res.expect("`income()` method on `MockByteSource` should never fail");

    // Returned bytes' length must match the length of the sent data.
    assert_eq!(sde_response.bytes, SDE_TEXT.len());
}
