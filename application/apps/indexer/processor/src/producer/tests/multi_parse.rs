//! Tests for parsers returning multiple values

use std::collections::VecDeque;

use super::mock_byte_source::*;
use super::mock_parser::*;
use super::*;

use parsers::{Error as ParseError, ParseYield};

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

    let mut producer = MessageProducer::new(parser, source);
    let mut collector = GeneralLogCollector::default();

    // First results should be two messages with content
    let summary = producer.produce_next(&mut collector).await.unwrap();
    match summary {
        ProduceSummary::Processed {
            bytes_consumed,
            messages_count,
            skipped_bytes,
        } => {
            assert_eq!(messages_count, 2);
            assert_eq!(bytes_consumed, 10);
            assert_eq!(skipped_bytes, 0);
        }
        ProduceSummary::NoBytesAvailable { .. } | ProduceSummary::Done { .. } => {
            panic!("Summary should be Processed but got {summary:?}");
        }
    }

    let records = collector.get_records();
    assert_eq!(records.len(), 2);
    assert!(matches!(
        records[0],
        ParseYield::Message(MockMessage { content: 1 })
    ));
    assert!(matches!(
        records[1],
        ParseYield::Message(MockMessage { content: 2 })
    ));

    records.clear();

    // Two Skipped messages when Parser is returning None
    let summary = producer.produce_next(&mut collector).await.unwrap();
    match summary {
        ProduceSummary::Processed {
            bytes_consumed,
            messages_count,
            skipped_bytes,
        } => {
            assert_eq!(messages_count, 0);
            assert_eq!(bytes_consumed, 10);
            assert_eq!(skipped_bytes, 10);
        }
        ProduceSummary::NoBytesAvailable { .. } | ProduceSummary::Done { .. } => {
            panic!("Summary should be Processed but got {summary:?}");
        }
    }

    assert_eq!(collector.get_records().len(), 0);

    // NoBytesAvailable message should be sent
    let summary = producer.produce_next(&mut collector).await.unwrap();
    match summary {
        ProduceSummary::Processed { .. } | ProduceSummary::Done { .. } => {
            panic!("Summary should be Processed but got {summary:?}");
        }
        ProduceSummary::NoBytesAvailable { skipped_bytes } => {
            assert_eq!(skipped_bytes, 0);
        }
    }
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

    let mut producer = MessageProducer::new(parser, source);

    let mut collector = GeneralLogCollector::default();

    // First message should be two messages with content

    let summary = producer.produce_next(&mut collector).await.unwrap();
    match summary {
        ProduceSummary::Processed {
            bytes_consumed,
            messages_count,
            skipped_bytes,
        } => {
            assert_eq!(messages_count, 2);
            assert_eq!(bytes_consumed, 30);
            assert_eq!(skipped_bytes, 0);
        }
        ProduceSummary::NoBytesAvailable { .. } | ProduceSummary::Done { .. } => {
            panic!("Summary should be Processed but got {summary:?}");
        }
    }

    let records = collector.get_records();
    assert_eq!(records.len(), 2);
    assert!(matches!(
        records[0],
        ParseYield::Message(MockMessage { content: 1 })
    ));

    assert!(matches!(
        records[1],
        ParseYield::Message(MockMessage { content: 1 })
    ));

    // NoBytesAvailable message should be sent
    let summary = producer.produce_next(&mut collector).await.unwrap();
    match summary {
        ProduceSummary::Processed { .. } | ProduceSummary::Done { .. } => {
            panic!("Summary should be Processed but got {summary:?}");
        }
        ProduceSummary::NoBytesAvailable { skipped_bytes } => {
            assert_eq!(skipped_bytes, 0);
        }
    }
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

    let mut producer = MessageProducer::new(parser, source);
    let mut collector = GeneralLogCollector::default();

    // First two messages succeed.
    let summary = producer.produce_next(&mut collector).await.unwrap();
    match summary {
        ProduceSummary::Processed {
            bytes_consumed,
            messages_count,
            skipped_bytes,
        } => {
            assert_eq!(messages_count, 2);
            assert_eq!(bytes_consumed, 15);
            assert_eq!(skipped_bytes, 0);
        }
        ProduceSummary::NoBytesAvailable { .. } | ProduceSummary::Done { .. } => {
            panic!("Summary should be Processed but got {summary:?}");
        }
    }

    let records = collector.get_records();
    assert_eq!(records.len(), 2);

    assert!(matches!(
        records[0],
        ParseYield::Message(MockMessage { content: 1 })
    ));
    assert!(matches!(
        records[1],
        ParseYield::Message(MockMessage { content: 1 })
    ));

    records.clear();

    // Three parse error causing 3 bytes to drop.
    // Then two Messages with content should be yielded consuming all the bytes.
    let summary = producer.produce_next(&mut collector).await.unwrap();
    match summary {
        ProduceSummary::Processed {
            bytes_consumed,
            messages_count,
            skipped_bytes,
        } => {
            assert_eq!(messages_count, 2);
            assert_eq!(bytes_consumed, 10 + 5);
            assert_eq!(skipped_bytes, 3);
        }
        ProduceSummary::NoBytesAvailable { .. } | ProduceSummary::Done { .. } => {
            panic!("Summary should be Processed but got {summary:?}");
        }
    }

    let records = collector.get_records();
    assert_eq!(records.len(), 2);

    assert!(matches!(
        records[0],
        ParseYield::Message(MockMessage { content: 2 })
    ));
    assert!(matches!(
        records[1],
        ParseYield::Message(MockMessage { content: 2 })
    ));

    // NoBytesAvailable message should be sent
    let summary = producer.produce_next(&mut collector).await.unwrap();
    match summary {
        ProduceSummary::Processed { .. } | ProduceSummary::Done { .. } => {
            panic!("Summary should be Processed but got {summary:?}");
        }
        ProduceSummary::NoBytesAvailable { skipped_bytes } => {
            assert_eq!(skipped_bytes, 0);
        }
    }
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

    let mut producer = MessageProducer::new(parser, source);
    let mut collector = GeneralLogCollector::default();

    // Two Messages with content 1 should be yielded considering skipped bytes.
    let summary = producer.produce_next(&mut collector).await.unwrap();
    match summary {
        ProduceSummary::Processed {
            bytes_consumed,
            messages_count,
            skipped_bytes,
        } => {
            assert_eq!(messages_count, 2);
            assert_eq!(bytes_consumed, 8);
            assert_eq!(skipped_bytes, 4);
        }
        ProduceSummary::NoBytesAvailable { .. } | ProduceSummary::Done { .. } => {
            panic!("Summary should be Processed but got {summary:?}");
        }
    }

    let records = collector.get_records();
    assert_eq!(records.len(), 2);
    assert!(matches!(
        records[0],
        ParseYield::Message(MockMessage { content: 1 })
    ));
    assert!(matches!(
        records[1],
        ParseYield::Message(MockMessage { content: 1 })
    ));

    records.clear();

    // Two Skipped Messages.
    let summary = producer.produce_next(&mut collector).await.unwrap();
    match summary {
        ProduceSummary::Processed {
            bytes_consumed,
            messages_count,
            skipped_bytes,
        } => {
            assert_eq!(messages_count, 0);
            assert_eq!(bytes_consumed, 6);
            assert_eq!(skipped_bytes, 10);
        }
        ProduceSummary::NoBytesAvailable { .. } | ProduceSummary::Done { .. } => {
            panic!("Summary should be Processed but got {summary:?}");
        }
    }

    assert!(collector.get_records().is_empty());

    // One Skipped Messages.
    let summary = producer.produce_next(&mut collector).await.unwrap();
    match summary {
        ProduceSummary::Processed {
            bytes_consumed,
            messages_count,
            skipped_bytes,
        } => {
            assert_eq!(messages_count, 0);
            assert_eq!(bytes_consumed, 15);
            assert_eq!(skipped_bytes, 15);
        }
        ProduceSummary::NoBytesAvailable { .. } | ProduceSummary::Done { .. } => {
            panic!("Summary should be Processed but got {summary:?}");
        }
    }

    assert!(collector.get_records().is_empty());

    // NoBytesAvailable message should be sent
    let summary = producer.produce_next(&mut collector).await.unwrap();
    match summary {
        ProduceSummary::Processed { .. } | ProduceSummary::Done { .. } => {
            panic!("Summary should be Processed but got {summary:?}");
        }
        ProduceSummary::NoBytesAvailable { skipped_bytes } => {
            assert_eq!(skipped_bytes, 0);
        }
    }
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

    let mut producer = MessageProducer::new(parser, source);

    let mut collector = GeneralLogCollector::default();

    // Unrecoverable error should be sent and producer should close.
    let res = producer.produce_next(&mut collector).await;
    assert!(res.is_err_and(|err| matches!(err, ProduceError::Unrecoverable(..))));

    assert!(collector.get_records().is_empty());

    // Then the producer should be closed.
    let summary = producer.produce_next(&mut collector).await.unwrap();
    match summary {
        ProduceSummary::Processed { .. } | ProduceSummary::NoBytesAvailable { .. } => {
            panic!("Summary should be Done but got {summary:?}");
        }
        ProduceSummary::Done { .. } => {}
    }

    assert!(collector.get_records().is_empty());
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

    let mut producer = MessageProducer::new(parser, source);
    let mut collector = GeneralLogCollector::default();

    // Two Messages with content should be yielded considering the skipped bytes on the first item
    // only with both reload calls.

    let summary = producer.produce_next(&mut collector).await.unwrap();
    match summary {
        ProduceSummary::Processed {
            bytes_consumed,
            messages_count,
            skipped_bytes,
        } => {
            assert_eq!(messages_count, 2);
            assert_eq!(bytes_consumed, 4 + 6);
            assert_eq!(skipped_bytes, 4);
        }
        ProduceSummary::NoBytesAvailable { .. } | ProduceSummary::Done { .. } => {
            panic!("Summary should be Processed but got {summary:?}");
        }
    }

    let records = collector.get_records();
    assert_eq!(records.len(), 2);

    assert!(matches!(
        records[0],
        ParseYield::Message(MockMessage { content: 1 })
    ));
    assert!(matches!(
        records[1],
        ParseYield::Message(MockMessage { content: 1 })
    ));

    records.clear();

    // Two bytes dropped with parser errors then two messages.
    let summary = producer.produce_next(&mut collector).await.unwrap();
    match summary {
        ProduceSummary::Processed {
            bytes_consumed,
            messages_count,
            skipped_bytes,
        } => {
            assert_eq!(messages_count, 2);
            assert_eq!(bytes_consumed, 4 + 10);
            assert_eq!(skipped_bytes, 6);
        }
        ProduceSummary::NoBytesAvailable { .. } | ProduceSummary::Done { .. } => {
            panic!("Summary should be Processed but got {summary:?}");
        }
    }

    let records = collector.get_records();
    assert_eq!(records.len(), 2);

    assert!(matches!(
        records[0],
        ParseYield::Message(MockMessage { content: 2 })
    ));
    assert!(matches!(
        records[1],
        ParseYield::Message(MockMessage { content: 2 })
    ));
    records.clear();

    let res = producer.produce_next(&mut collector).await;
    assert!(res.is_err_and(|err| matches!(err, ProduceError::Parse(..))));

    // NoBytesAvailable message should be sent
    let summary = producer.produce_next(&mut collector).await.unwrap();
    match summary {
        ProduceSummary::Processed { .. } | ProduceSummary::Done { .. } => {
            panic!("Summary should be Processed but got {summary:?}");
        }
        ProduceSummary::NoBytesAvailable { skipped_bytes } => {
            assert_eq!(skipped_bytes, 0);
        }
    }
}
