//! Tests for parsers returning multiple values

use std::collections::VecDeque;

use super::mock_byte_source::*;
use super::mock_parser::*;
use super::*;

use parsers::{Error as ParseError, ParseYield};

use crate::producer::CombinedProducer;

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

    let mut producer = CombinedProducer::new(parser, source);

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

    let mut producer = CombinedProducer::new(parser, source);

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

    let mut producer = CombinedProducer::new(parser, source);

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

    let mut producer = CombinedProducer::new(parser, source);

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

    let mut producer = CombinedProducer::new(parser, source);

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

    let mut producer = CombinedProducer::new(parser, source);

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
