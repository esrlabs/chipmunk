//! Tests for parsers returning multiple values

use std::collections::VecDeque;
use std::time::Duration;

use super::mock_byte_source::*;
use super::mock_parser::*;
use super::*;

use parsers::{Error as ParseError, ParseYield};
use tokio::sync::{mpsc::unbounded_channel, oneshot};

use crate::producer::MessageProducer;

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

    // First results should be two messages with content
    let next = producer.read_next_segment().await.unwrap();
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
    let next = producer.read_next_segment().await.unwrap();
    assert_eq!(next.len(), 2);
    assert!(matches!(next[0], (4, MessageStreamItem::Skipped)));
    assert!(matches!(next[1], (6, MessageStreamItem::Skipped)));

    // Done message should be sent
    let next = producer.read_next_segment().await.unwrap();
    assert_eq!(next.len(), 1);
    assert!(matches!(next[0], (0, MessageStreamItem::Done)));

    // Then the stream should be closed
    let next = producer.read_next_segment().await;
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

    // First message should be two messages with content
    let next = producer.read_next_segment().await.unwrap();
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
    let next = producer.read_next_segment().await.unwrap();
    assert_eq!(next.len(), 1);
    assert!(matches!(next[0], (0, MessageStreamItem::Done)));

    // Then the stream should be closed
    let next = producer.read_next_segment().await;
    assert!(next.is_none());
}

#[tokio::test]
async fn success_parse_err_success() {
    let parser = MockParser::new([
        Ok(vec![
            MockParseSeed::new(10, Some(ParseYield::Message(MockMessage::from(1)))),
            MockParseSeed::new(5, Some(ParseYield::Message(MockMessage::from(1)))),
        ]),
        Err(ParseError::Parse(Default::default())),
        Err(ParseError::Parse(Default::default())),
        Err(ParseError::Parse(Default::default())),
        Ok(vec![
            MockParseSeed::new(10, Some(ParseYield::Message(MockMessage::from(2)))),
            MockParseSeed::new(5, Some(ParseYield::Message(MockMessage::from(2)))),
        ]),
    ]);

    let source = MockByteSource::new(
        0,
        [
            Ok(Some(MockReloadSeed::new(17, 0))),
            Ok(Some(MockReloadSeed::new(1, 0))),
            Ok(Some(MockReloadSeed::new(15, 0))),
            Ok(None),
        ],
    );

    let mut producer = MessageProducer::new(parser, source, None);

    // First two messages succeed.
    let next = producer.read_next_segment().await.unwrap();
    assert_eq!(next.len(), 2);
    assert!(matches!(
        next[0],
        (
            10,
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

    // Three parse error causing 3 bytes to drop.
    // Then two Messages with content should be yielded consuming all the bytes.
    let next = producer.read_next_segment().await.unwrap();
    assert_eq!(next.len(), 2);
    assert!(matches!(
        next[0],
        (
            13, // 10 items + 3 bytes
            MessageStreamItem::Item(ParseYield::Message(MockMessage { content: 2 }))
        )
    ));
    assert!(matches!(
        next[1],
        (
            5,
            MessageStreamItem::Item(ParseYield::Message(MockMessage { content: 2 }))
        )
    ));

    // Done message should be sent
    let next = producer.read_next_segment().await.unwrap();
    assert_eq!(next.len(), 1);
    assert!(matches!(next[0], (0, MessageStreamItem::Done)));

    // Then the stream should be closed
    let next = producer.read_next_segment().await;
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

    // Two Messages with content 1 should be yielded considering skipped bytes on the first item
    // only
    let next = producer.read_next_segment().await.unwrap();
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
    let next = producer.read_next_segment().await.unwrap();
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
    let next = producer.read_next_segment().await.unwrap();
    assert_eq!(next.len(), 1);
    assert!(matches!(
        next[0],
        (
            15, // 15 consumed + 0 skipped
            MessageStreamItem::Skipped
        )
    ));

    // Done message should be sent.
    let next = producer.read_next_segment().await.unwrap();
    assert_eq!(next.len(), 1);
    assert!(matches!(next[0], (0, MessageStreamItem::Done)));

    // Then the stream should be closed
    let next = producer.read_next_segment().await;
    assert!(next.is_none());
}

#[tokio::test]
async fn initial_parsing_error() {
    // Test to simulate a byte source delivering bytes more than INITIAL_PARSE_ERROR_LIMIT
    // in one shot, ensuring that the session will be terminated on parse errors with total
    // amount of loaded bytes without calling load on source anymore.

    const LOADED_BYTES_COUNT: usize = INITIAL_PARSE_ERROR_LIMIT * 2;

    let parse_seeds: VecDeque<_> =
        std::iter::repeat_with(|| Err(ParseError::Parse(Default::default())))
            .take(INITIAL_PARSE_ERROR_LIMIT + 2)
            .collect();

    let parser = MockParser::new(parse_seeds);

    let source = MockByteSource::new(0, [Ok(Some(MockReloadSeed::new(LOADED_BYTES_COUNT, 0)))]);

    let mut producer = MessageProducer::new(parser, source, None);

    // Done message should be sent on initial parsing with unused bytes,
    // considering the skipped bytes.
    let next = producer.read_next_segment().await.unwrap();
    assert_eq!(next.len(), 1);
    assert!(matches!(
        next[0],
        (LOADED_BYTES_COUNT, MessageStreamItem::Done)
    ));

    // Then the stream should be closed
    let next = producer.read_next_segment().await;
    assert!(next.is_none());
}

#[tokio::test]
async fn success_parse_error_success_err_skipped_bytes() {
    let parser = MockParser::new([
        Ok(vec![
            MockParseSeed::new(4, Some(ParseYield::Message(MockMessage::from(1)))),
            MockParseSeed::new(6, Some(ParseYield::Message(MockMessage::from(1)))),
        ]),
        Err(ParseError::Parse(Default::default())),
        Err(ParseError::Parse(Default::default())),
        Ok(vec![
            MockParseSeed::new(4, Some(ParseYield::Message(MockMessage::from(2)))),
            MockParseSeed::new(10, Some(ParseYield::Message(MockMessage::from(2)))),
        ]),
        Err(ParseError::Parse(Default::default())),
        Err(ParseError::Parse(Default::default())),
        Err(ParseError::Parse(Default::default())),
        Err(ParseError::Parse(Default::default())),
    ]);

    let source = MockByteSource::new(
        0,
        [
            Ok(Some(MockReloadSeed::new(10, 4))),
            Ok(Some(MockReloadSeed::new(20, 4))),
            Ok(None),
            Ok(None),
            Ok(None),
        ],
    );

    let mut producer = MessageProducer::new(parser, source, None);

    // Two Messages with content should be yielded considering the skipped bytes on the first item
    // only with both reload calls.
    let next = producer.read_next_segment().await.unwrap();
    assert_eq!(next.len(), 2);
    assert!(matches!(
        next[0],
        (
            8, // 4 consumed + 4 skipped by byte source.
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

    // Two bytes dropped with parser errors then two messages.
    let next = producer.read_next_segment().await.unwrap();
    assert_eq!(next.len(), 2);
    assert!(matches!(
        next[0],
        (
            10, // 4 Item + 2 dropped due to parser error + 4 skipped in byte source
            MessageStreamItem::Item(ParseYield::Message(MockMessage { content: 2 }))
        )
    ));
    assert!(matches!(
        next[1],
        (
            10,
            MessageStreamItem::Item(ParseYield::Message(MockMessage { content: 2 }))
        )
    ));

    // Four error messages should happen here causing dropping four bytes.
    // Then Done message should be sent
    let next = producer.read_next_segment().await.unwrap();
    assert_eq!(next.len(), 1);
    assert!(matches!(next[0], (4, MessageStreamItem::Done)));

    // Then the stream should be closed
    let next = producer.read_next_segment().await;
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

    // Send message to sde receiver before calling next.
    let (tx_sde_response, mut rx_sde_response) = oneshot::channel();
    const SDE_TEXT: &str = "sde_msg";
    tx_sde
        .send((
            stypes::SdeRequest::WriteText(String::from(SDE_TEXT)),
            tx_sde_response,
        ))
        .unwrap();

    // The first source seed has a delay and won't be picked in the `select!` macro in the producer
    // loop, and it will be dropped because `reload()` in `MockByteSource` isn't cancel safe.
    let next = producer.read_next_segment().await.unwrap();
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
