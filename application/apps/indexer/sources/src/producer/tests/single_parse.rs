//! Tests for parsers returning single value always

use std::collections::VecDeque;
use std::time::Duration;

use super::mock_byte_source::*;
use super::mock_parser::*;
use super::*;

use parsers::{Error as ParseError, ParseYield};
use tokio::sync::{mpsc::unbounded_channel, oneshot};

use crate::{producer::MessageProducer, Error};

#[tokio::test]
async fn empty_byte_source() {
    let parser = MockParser::new([]);
    let source = MockByteSource::new(0, [Ok(None)]);

    let mut producer = MessageProducer::new(parser, source, None);

    let next = producer.read_next_segment().await.unwrap();
    assert_eq!(next.len(), 1);
    assert!(matches!(next[0], (0, MessageStreamItem::Done)));

    let next = producer.read_next_segment().await;
    assert!(next.is_none());
}

#[tokio::test]
async fn byte_source_fail() {
    let parser = MockParser::new([]);
    let source = MockByteSource::new(0, [Err(Error::NotSupported)]);

    let mut producer = MessageProducer::new(parser, source, None);

    // Done message should be sent
    let next = producer.read_next_segment().await.unwrap();
    assert_eq!(next.len(), 1);
    assert!(matches!(next[0], (0, MessageStreamItem::Done)));

    // Then the stream should be closed
    let next = producer.read_next_segment().await;
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

    // First results should be one message with content
    let next = producer.read_next_segment().await.unwrap();
    assert_eq!(next.len(), 1);
    assert!(matches!(
        next[0],
        (
            5,
            MessageStreamItem::Item(ParseYield::Message(MockMessage { content: 1 }))
        )
    ));

    // Skipped message when Parser is returning None
    let next = producer.read_next_segment().await.unwrap();
    assert_eq!(next.len(), 1);
    assert!(matches!(next[0], (5, MessageStreamItem::Skipped)));

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

    // First message should be message with content
    let next = producer.read_next_segment().await.unwrap();
    assert_eq!(next.len(), 1);
    assert!(matches!(
        next[0],
        (
            5,
            MessageStreamItem::Item(ParseYield::Message(MockMessage { content: 1 }))
        )
    ));

    // Second message consumes all the remaining bytes.
    let next = producer.read_next_segment().await.unwrap();
    assert_eq!(next.len(), 1);
    assert!(matches!(
        next[0],
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

    // Stream should be closed directly if reload failed after parser returning Incomplete error
    let next = producer.read_next_segment().await;
    assert!(next.is_none());
}

#[tokio::test]
async fn parse_err_eof() {
    let parser = MockParser::new([Err(ParseError::Eof)]);
    let source = MockByteSource::new(0, [Ok(Some(MockReloadSeed::new(10, 0)))]);

    let mut producer = MessageProducer::new(parser, source, None);

    // Stream should be closed directly if parse returns `Error::Eof`
    let next = producer.read_next_segment().await;
    assert!(next.is_none());
}

#[tokio::test]
async fn initial_parsing_error() {
    // Test to simulate a byte source delivering one bytes on each call to be dropped
    // with parse error.

    // Parse & Load will be called until skipped bytes are greater than INITIAL_PARSE_ERROR_LIMIT
    const FINAL_BYTES_COUNT: usize = INITIAL_PARSE_ERROR_LIMIT + 2;

    let parse_seeds: VecDeque<_> =
        std::iter::repeat_with(|| Err(ParseError::Parse(Default::default())))
            .take(FINAL_BYTES_COUNT)
            .collect();
    let parser = MockParser::new(parse_seeds);

    let source_seeds: VecDeque<_> = std::iter::repeat_with(|| Ok(Some(MockReloadSeed::new(1, 0))))
        .take(FINAL_BYTES_COUNT)
        .collect();

    let source = MockByteSource::new(0, source_seeds);

    let mut producer = MessageProducer::new(parser, source, None);

    // Initial error should abort the session.
    let next = producer.read_next_segment().await.unwrap();
    assert_eq!(next.len(), 1);
    assert!(matches!(
        next[0],
        (FINAL_BYTES_COUNT, MessageStreamItem::Done)
    ));

    // Then the stream should be closed
    let next = producer.read_next_segment().await;
    assert!(next.is_none());
}

#[tokio::test]
async fn success_parse_err_success() {
    let parser = MockParser::new([
        Ok(vec![MockParseSeed::new(
            10,
            Some(ParseYield::Message(MockMessage::from(1))),
        )]),
        Err(ParseError::Parse(Default::default())),
        Err(ParseError::Parse(Default::default())),
        Err(ParseError::Parse(Default::default())),
        Ok(vec![MockParseSeed::new(
            10,
            Some(ParseYield::Message(MockMessage::from(2))),
        )]),
    ]);

    let source = MockByteSource::new(
        0,
        [
            Ok(Some(MockReloadSeed::new(10, 0))),
            Ok(Some(MockReloadSeed::new(3, 0))),
            Ok(Some(MockReloadSeed::new(10, 0))),
            Ok(None),
        ],
    );

    let mut producer = MessageProducer::new(parser, source, None);

    // Message with content should be yielded consuming all the bytes.
    let next = producer.read_next_segment().await.unwrap();
    assert_eq!(next.len(), 1);
    assert!(matches!(
        next[0],
        (
            10,
            MessageStreamItem::Item(ParseYield::Message(MockMessage { content: 1 }))
        )
    ));

    // Then three parse errors should happen internally with one byte dropped from source
    // then load will be called providing 10 bytes which will be consumed by next parser call.

    // Second Message with content should be yielded consuming 10 the bytes.
    let next = producer.read_next_segment().await.unwrap();
    assert_eq!(next.len(), 1);
    assert!(matches!(
        next[0],
        (
            13, // 10 item + 3 skipped
            MessageStreamItem::Item(ParseYield::Message(MockMessage { content: 2 }))
        )
    ));

    // Internal byte source must be empty
    assert_eq!(producer.byte_source.len(), 0);

    // Done message should be sent
    let next = producer.read_next_segment().await.unwrap();
    assert_eq!(next.len(), 1);
    assert!(matches!(next[0], (0, MessageStreamItem::Done)));

    // Then the stream should be closed
    let next = producer.read_next_segment().await;
    assert!(next.is_none());
}

#[tokio::test]
async fn success_parse_err_done() {
    let parser = MockParser::new([
        Ok(vec![MockParseSeed::new(
            10,
            Some(ParseYield::Message(MockMessage::from(1))),
        )]),
        Err(ParseError::Parse(Default::default())),
        Err(ParseError::Parse(Default::default())),
        Err(ParseError::Parse(Default::default())),
    ]);

    let source = MockByteSource::new(
        0,
        [
            Ok(Some(MockReloadSeed::new(10, 0))),
            Ok(Some(MockReloadSeed::new(3, 0))),
            Ok(None),
        ],
    );

    let mut producer = MessageProducer::new(parser, source, None);

    // Message with content should be yielded consuming all the bytes.
    let next = producer.read_next_segment().await.unwrap();
    assert_eq!(next.len(), 1);
    assert!(matches!(
        next[0],
        (
            10,
            MessageStreamItem::Item(ParseYield::Message(MockMessage { content: 1 }))
        )
    ));

    // Then three parse errors should happen internally with one byte dropped from source
    // then load will be called providing no new bytes causing the session to end.

    // Done message should be sent
    let next = producer.read_next_segment().await.unwrap();
    assert_eq!(next.len(), 1);
    assert!(matches!(next[0], (3, MessageStreamItem::Done)));

    // Internal byte source must be empty
    assert_eq!(producer.byte_source.len(), 0);

    // Then the stream should be closed
    let next = producer.read_next_segment().await;
    assert!(next.is_none());
}

#[tokio::test]
async fn success_parsing_error_then_fail_reload() {
    let parser = MockParser::new([
        Ok(vec![MockParseSeed::new(
            10,
            Some(ParseYield::Message(MockMessage::from(1))),
        )]),
        Err(ParseError::Parse(Default::default())),
        Err(ParseError::Parse(Default::default())),
        Err(ParseError::Parse(Default::default())),
    ]);

    let source = MockByteSource::new(
        0,
        [
            Ok(Some(MockReloadSeed::new(10, 0))),
            Ok(Some(MockReloadSeed::new(3, 0))),
            Err(Error::Setup(String::default())),
        ],
    );

    let mut producer = MessageProducer::new(parser, source, None);

    // Message with content should be yielded consuming all the bytes.
    let next = producer.read_next_segment().await.unwrap();
    assert_eq!(next.len(), 1);
    assert!(matches!(
        next[0],
        (
            10,
            MessageStreamItem::Item(ParseYield::Message(MockMessage { content: 1 }))
        )
    ));

    // Then three parse errors should happen internally with one byte dropped from source
    // then load will be called returning an error causing the session to end.

    // Done message should be sent
    let next = producer.read_next_segment().await.unwrap();
    assert_eq!(next.len(), 1);
    assert!(matches!(next[0], (3, MessageStreamItem::Done)));

    // Internal byte source must be empty
    assert_eq!(producer.byte_source.len(), 0);

    // Then the stream should be closed
    let next = producer.read_next_segment().await;
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

    // Message with content 1 should be yielded considering skipped bytes
    let next = producer.read_next_segment().await.unwrap();
    assert_eq!(next.len(), 1);
    assert!(matches!(
        next[0],
        (
            7, // 7: 3 consumed + 4 skipped
            MessageStreamItem::Item(ParseYield::Message(MockMessage { content: 1 }))
        )
    ));

    // Skipped Message should be yielded considering skipped bytes
    let next = producer.read_next_segment().await.unwrap();
    assert_eq!(next.len(), 1);
    assert!(matches!(
        next[0],
        (
            6, // 6: 2 consumed + 4 skipped
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
async fn success_parsi_err_success_drain_bytes() {
    let parser = MockParser::new([
        Ok(vec![MockParseSeed::new(
            5,
            Some(ParseYield::Message(MockMessage::from(1))),
        )]),
        Err(ParseError::Parse(Default::default())),
        Ok(vec![MockParseSeed::new(
            5,
            Some(ParseYield::Message(MockMessage::from(2))),
        )]),
        Ok(vec![MockParseSeed::new(
            9,
            Some(ParseYield::Message(MockMessage::from(3))),
        )]),
    ]);

    let source = MockByteSource::new(
        0,
        [
            Ok(Some(MockReloadSeed::new(10, 3))),
            Ok(Some(MockReloadSeed::new(10, 3))),
            Ok(None),
            Ok(None),
        ],
    );

    let mut producer = MessageProducer::new(parser, source, None);

    // First successful parse
    let next = producer.read_next_segment().await.unwrap();
    assert_eq!(next.len(), 1);
    assert!(matches!(
        next[0],
        (
            8, // 5 item + 3 source
            MessageStreamItem::Item(ParseYield::Message(MockMessage { content: 1 }))
        )
    ));

    // One error then successful parse
    // Second successful parse
    let next = producer.read_next_segment().await.unwrap();
    assert_eq!(next.len(), 1);
    assert!(matches!(
        next[0],
        (
            9, // 5 item + 3 skipped from source + 1 skipped from parse error
            MessageStreamItem::Item(ParseYield::Message(MockMessage { content: 2 }))
        )
    ));

    // Load doesn't have provide new bytes but it still have some available.
    // Third successful parse
    let next = producer.read_next_segment().await.unwrap();
    assert_eq!(next.len(), 1);
    assert!(matches!(
        next[0],
        (
            9,
            MessageStreamItem::Item(ParseYield::Message(MockMessage { content: 3 }))
        )
    ));

    // Done message should be sent with unused bytes, considering the skipped bytes.
    let next = producer.read_next_segment().await.unwrap();
    assert_eq!(next.len(), 1);
    assert!(matches!(next[0], (0, MessageStreamItem::Done)));

    // Then the stream should be closed
    let next = producer.read_next_segment().await;
    assert!(next.is_none());
}

#[tokio::test]
/// This function tests the sde SDE Communication in the producer loop
async fn sde_communication() {
    let parser = MockParser::new([
        Ok(vec![MockParseSeed::new(
            5,
            Some(ParseYield::Message(MockMessage::from(1))),
        )]),
        Ok(vec![MockParseSeed::new(
            10,
            Some(ParseYield::Message(MockMessage::from(2))),
        )]),
    ]);

    // The duration which `reload()` should wait for before delivering the data.
    const SLEEP_DURATION: Duration = Duration::from_millis(50);

    let source = MockByteSource::new(
        0,
        [
            // Both of the values here must be delivered because SDE is cancel safe.
            Ok(Some(
                MockReloadSeed::new(5, 0).sleep_duration(SLEEP_DURATION),
            )),
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

    let next = producer.read_next_segment().await.unwrap();
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

    // Bytes for next item should be delivered and item should be parsed.
    let next = producer.read_next_segment().await.unwrap();
    assert_eq!(next.len(), 1);
    assert!(matches!(
        next[0],
        (
            10,
            MessageStreamItem::Item(ParseYield::Message(MockMessage { content: 2 }))
        )
    ));
}
