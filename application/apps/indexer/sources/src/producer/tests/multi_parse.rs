//! Tests for parsers returning multiple values

use std::time::Duration;

use super::mock_byte_source::*;
use super::mock_parser::*;
use super::*;

use futures::{pin_mut, StreamExt};
use parsers::{Error as ParseError, ParseYield};
use tokio::sync::{mpsc::unbounded_channel, oneshot};

use crate::{producer::MessageProducer, sde::SdeRequest};

#[tokio::test]
async fn parse_items_then_skip() {
    let parser = MockParser::new([
        Ok(vec![
            MockParseSeed::new(4, Some(ParseYield::Message(MockMessage::from(1)))),
            MockParseSeed::new(6, Some(ParseYield::Message(MockMessage::from(2)))),
        ]),
        Ok(vec![
            MockParseSeed::new(4, None),
            MockParseSeed::new(6, None),
        ]),
    ]);
    let source = MockByteSource::new(
        0,
        [
            Ok(Some(MockReloadSeed::new(20, 0))),
            Ok(Some(MockReloadSeed::new(0, 0))),
            Ok(None),
        ],
    );

    let mut producer = MessageProducer::new(parser, source, None);

    let stream = producer.as_stream();
    pin_mut!(stream);

    // First results should be two messages with content
    let next = stream.next().await.unwrap();
    assert_eq!(next.len(), 2);
    assert!(matches!(
        next[0],
        (
            4,
            MessageStreamItem::Item(ParseYield::Message(MockMessage { content: 1 }))
        )
    ));
    assert!(matches!(
        next[1],
        (
            6,
            MessageStreamItem::Item(ParseYield::Message(MockMessage { content: 2 }))
        )
    ));

    // Two Skipped messages when Parser is returning None
    let next = stream.next().await.unwrap();
    assert_eq!(next.len(), 2);
    assert!(matches!(next[0], (4, MessageStreamItem::Skipped)));
    assert!(matches!(next[1], (6, MessageStreamItem::Skipped)));

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
        Ok(vec![
            MockParseSeed::new(5, Some(ParseYield::Message(MockMessage::from(1)))),
            MockParseSeed::new(25, Some(ParseYield::Message(MockMessage::from(1)))),
        ]),
    ]);
    let source = MockByteSource::new(
        0,
        [
            Ok(Some(MockReloadSeed::new(10, 0))),
            Ok(Some(MockReloadSeed::new(10, 0))),
            Ok(Some(MockReloadSeed::new(10, 0))),
            Ok(None),
        ],
    );

    let mut producer = MessageProducer::new(parser, source, None);

    let stream = producer.as_stream();
    pin_mut!(stream);

    // First message should be message with content and two items
    let next = stream.next().await.unwrap();
    assert_eq!(next.len(), 2);
    assert!(matches!(
        next[0],
        (
            5,
            MessageStreamItem::Item(ParseYield::Message(MockMessage { content: 1 }))
        )
    ));

    assert!(matches!(
        next[1],
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
async fn parsing_error_success_reload() {
    let parser = MockParser::new([
        Err(ParseError::Parse(Default::default())),
        Ok(vec![
            MockParseSeed::new(10, Some(ParseYield::Message(MockMessage::from(1)))),
            MockParseSeed::new(5, Some(ParseYield::Message(MockMessage::from(1)))),
        ]),
    ]);

    let source = MockByteSource::new(
        0,
        [
            Ok(Some(MockReloadSeed::new(10, 0))),
            Ok(Some(MockReloadSeed::new(15, 0))),
            Ok(None),
        ],
    );

    let mut producer = MessageProducer::new(parser, source, None);

    let stream = producer.as_stream();
    pin_mut!(stream);

    // Message with content should be yielded consuming all the bytes.
    let next = stream.next().await.unwrap();
    assert_eq!(next.len(), 2);
    assert!(matches!(
        next[0],
        (
            20,
            MessageStreamItem::Item(ParseYield::Message(MockMessage { content: 1 }))
        )
    ));
    assert!(matches!(
        next[1],
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
async fn parse_with_skipped_bytes() {
    let parser = MockParser::new([
        Ok(vec![
            MockParseSeed::new(3, Some(ParseYield::Message(MockMessage::from(1)))),
            MockParseSeed::new(5, Some(ParseYield::Message(MockMessage::from(1)))),
        ]),
        Ok(vec![
            MockParseSeed::new(2, None),
            MockParseSeed::new(4, None),
        ]),
        Ok(vec![MockParseSeed::new(15, None)]),
    ]);

    let source = MockByteSource::new(
        0,
        [
            Ok(Some(MockReloadSeed::new(14, 4))),
            Ok(Some(MockReloadSeed::new(15, 4))),
            Ok(None),
            Ok(None),
        ],
    );

    let mut producer = MessageProducer::new(parser, source, None);

    let stream = producer.as_stream();
    pin_mut!(stream);

    // Two Messages with content 1 should be yielded considering skipped bytes on the first item
    // only
    let next = stream.next().await.unwrap();
    assert_eq!(next.len(), 2);
    assert!(matches!(
        next[0],
        (
            7, // 7: 3 consumed + 4 skipped
            MessageStreamItem::Item(ParseYield::Message(MockMessage { content: 1 }))
        )
    ));
    assert!(matches!(
        next[1],
        (
            5, // 5consumed
            MessageStreamItem::Item(ParseYield::Message(MockMessage { content: 1 }))
        )
    ));

    // Two Skipped Message should be yielded considering skipped bytes on the first item only
    let next = stream.next().await.unwrap();
    assert_eq!(next.len(), 2);
    assert!(matches!(
        next[0],
        (
            6, // 6: 2 consumed + 4 skipped
            MessageStreamItem::Skipped
        )
    ));
    assert!(matches!(
        next[1],
        (
            4, // 4 consumed
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
        Ok(vec![
            MockParseSeed::new(4, Some(ParseYield::Message(MockMessage::from(1)))),
            MockParseSeed::new(6, Some(ParseYield::Message(MockMessage::from(1)))),
        ]),
    ]);

    let source = MockByteSource::new(0, [Ok(Some(MockReloadSeed::new(10, 3))), Ok(None)]);

    let mut producer = MessageProducer::new(parser, source, None);

    let stream = producer.as_stream();
    pin_mut!(stream);

    // Done message should be sent with unused bytes, considering the skipped bytes.
    // Multiple return parse values shouldn't matter here.
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
        Ok(vec![
            MockParseSeed::new(4, Some(ParseYield::Message(MockMessage::from(1)))),
            MockParseSeed::new(6, Some(ParseYield::Message(MockMessage::from(1)))),
        ]),
        Ok(vec![
            MockParseSeed::new(4, Some(ParseYield::Message(MockMessage::from(1)))),
            MockParseSeed::new(6, Some(ParseYield::Message(MockMessage::from(1)))),
        ]),
    ]);

    let source = MockByteSource::new(
        0,
        [
            Ok(Some(MockReloadSeed::new(10, 4))),
            Ok(Some(MockReloadSeed::new(20, 4))),
            Ok(None),
            Ok(None),
        ],
    );

    let mut producer = MessageProducer::new(parser, source, None);

    let stream = producer.as_stream();
    pin_mut!(stream);

    // Two Messages with content should be yielded considering the skipped bytes on the first item
    // only with both reload calls.
    let next = stream.next().await.unwrap();
    assert_eq!(next.len(), 2);
    assert!(matches!(
        next[0],
        (
            22, // 22: 4 consumed + 10 skipped from Error::Parse match branch + (4 + 4) skipped
            MessageStreamItem::Item(ParseYield::Message(MockMessage { content: 1 }))
        )
    ));
    assert!(matches!(
        next[1],
        (
            6, // 6 consumed
            MessageStreamItem::Item(ParseYield::Message(MockMessage { content: 1 }))
        )
    ));

    // Two Messages use all available bytes.
    let next = stream.next().await.unwrap();
    assert_eq!(next.len(), 2);
    assert!(matches!(
        next[0],
        (
            4,
            MessageStreamItem::Item(ParseYield::Message(MockMessage { content: 1 }))
        )
    ));
    assert!(matches!(
        next[1],
        (
            6,
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
    let parser = MockParser::new([Ok(vec![
        MockParseSeed::new(4, Some(ParseYield::Message(MockMessage::from(1)))),
        MockParseSeed::new(6, Some(ParseYield::Message(MockMessage::from(1)))),
    ])]);

    // The duration which `reload()` should wait for before delivering the data.
    const SLEEP_DURATION: Duration = Duration::from_millis(50);

    let source = MockByteSource::new(
        0,
        [
            // This value must never be delivered because `reload()` on `MockByteSource`
            // isn't cancel safe, and the value here will be dropped with the `reload()` future
            // within the `select!()` macro in producer loop.
            Ok(Some(
                MockReloadSeed::new(10, 0).sleep_duration(SLEEP_DURATION),
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
    assert_eq!(next.len(), 2);
    assert!(matches!(
        next[0],
        (
            4,
            MessageStreamItem::Item(ParseYield::Message(MockMessage { content: 1 }))
        )
    ));
    assert!(matches!(
        next[1],
        (
            6,
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
