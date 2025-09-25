//! Tests for parsers returning single value always

use std::collections::VecDeque;

use super::mock_byte_source::*;
use super::mock_parser::*;
use super::*;

use parsers::{Error as ParseError, ParseYield};
use sources::Error;

use crate::producer::MessageProducer;

#[tokio::test]
async fn empty_byte_source() {
    let parser = MockParser::new([]);
    let source = MockByteSource::new(0, [Ok(None)]);

    let mut producer = MessageProducer::new(parser, source);
    let mut collector = GeneralLogCollector::default();

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
async fn byte_source_fail() {
    let parser = MockParser::new([]);
    let source = MockByteSource::new(0, [Err(Error::NotSupported)]);

    let mut producer = MessageProducer::new(parser, source);
    let mut collector = GeneralLogCollector::default();

    // Source error should be sent and producer should close.
    let res = producer.produce_next(&mut collector).await;
    assert!(res.is_err_and(|err| matches!(err, ProduceError::SourceError(..))));

    assert!(collector.get_records().is_empty());
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

    let mut producer = MessageProducer::new(parser, source);
    let mut collector = GeneralLogCollector::default();

    // First results should be one message with content
    let summary = producer.produce_next(&mut collector).await.unwrap();
    match summary {
        ProduceSummary::Processed {
            bytes_consumed,
            messages_count,
            skipped_bytes,
        } => {
            assert_eq!(messages_count, 1);
            assert_eq!(bytes_consumed, 5);
            assert_eq!(skipped_bytes, 0);
        }
        ProduceSummary::NoBytesAvailable { .. } | ProduceSummary::Done { .. } => {
            panic!("Summary should be Processed but got {summary:?}");
        }
    }

    let records = collector.get_records();
    assert_eq!(records.len(), 1);
    assert!(matches!(
        records[0],
        ParseYield::Message(MockMessage { content: 1 })
    ));
    records.clear();

    // Skipped message from parser.
    let summary = producer.produce_next(&mut collector).await.unwrap();
    match summary {
        ProduceSummary::Processed {
            bytes_consumed,
            messages_count,
            skipped_bytes,
        } => {
            assert_eq!(messages_count, 0);
            assert_eq!(bytes_consumed, 5);
            assert_eq!(skipped_bytes, 5);
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

    assert_eq!(collector.get_records().len(), 0);
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

    let mut producer = MessageProducer::new(parser, source);
    let mut collector = GeneralLogCollector::default();

    // First message should be message with content
    let summary = producer.produce_next(&mut collector).await.unwrap();
    match summary {
        ProduceSummary::Processed {
            bytes_consumed,
            messages_count,
            skipped_bytes,
        } => {
            assert_eq!(messages_count, 1);
            assert_eq!(bytes_consumed, 5);
            assert_eq!(skipped_bytes, 0);
        }
        ProduceSummary::NoBytesAvailable { .. } | ProduceSummary::Done { .. } => {
            panic!("Summary should be Processed but got {summary:?}");
        }
    }

    let records = collector.get_records();
    assert_eq!(records.len(), 1);
    assert!(matches!(
        records[0],
        ParseYield::Message(MockMessage { content: 1 })
    ));
    records.clear();

    // Second message consumes all the remaining bytes.

    let summary = producer.produce_next(&mut collector).await.unwrap();
    match summary {
        ProduceSummary::Processed {
            bytes_consumed,
            messages_count,
            skipped_bytes,
        } => {
            assert_eq!(messages_count, 1);
            assert_eq!(bytes_consumed, 25);
            assert_eq!(skipped_bytes, 0);
        }
        ProduceSummary::NoBytesAvailable { .. } | ProduceSummary::Done { .. } => {
            panic!("Summary should be Processed but got {summary:?}");
        }
    }

    let records = collector.get_records();
    assert_eq!(records.len(), 1);
    assert!(matches!(
        records[0],
        ParseYield::Message(MockMessage { content: 1 })
    ));
    records.clear();

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

    assert_eq!(collector.get_records().len(), 0);
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

    let mut producer = MessageProducer::new(parser, source);
    let mut collector = GeneralLogCollector::default();

    // Produce should return source error directly if reload failed after
    // parser returning Incomplete error
    let res = producer.produce_next(&mut collector).await;
    assert!(res.is_err_and(|err| matches!(err, ProduceError::SourceError(..))));

    assert!(collector.get_records().is_empty());
}

#[tokio::test]
async fn parse_err_eof() {
    let parser = MockParser::new([Err(ParseError::Eof)]);
    let source = MockByteSource::new(0, [Ok(Some(MockReloadSeed::new(10, 0)))]);

    let mut producer = MessageProducer::new(parser, source);
    let mut collector = GeneralLogCollector::default();

    // Producer should be closed directly if parse returns `Error::Eof`
    let summary = producer.produce_next(&mut collector).await.unwrap();
    match summary {
        ProduceSummary::Done {
            loaded_bytes,
            skipped_bytes,
            produced_messages,
        } => {
            assert_eq!(loaded_bytes, 10);
            assert_eq!(skipped_bytes, 0);
            assert_eq!(produced_messages, 0);
        }
        ProduceSummary::NoBytesAvailable { .. } | ProduceSummary::Processed { .. } => {
            panic!("Summary should be Done but got {summary:?}");
        }
    }

    assert!(collector.get_records().is_empty());
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

    let mut producer = MessageProducer::new(parser, source);
    let mut collector = GeneralLogCollector::default();

    // Initial error should abort the session.
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

    let mut producer = MessageProducer::new(parser, source);
    let mut collector = GeneralLogCollector::default();

    // Message with content should be yielded consuming all the bytes.
    let summary = producer.produce_next(&mut collector).await.unwrap();
    match summary {
        ProduceSummary::Processed {
            bytes_consumed,
            messages_count,
            skipped_bytes,
        } => {
            assert_eq!(messages_count, 1);
            assert_eq!(bytes_consumed, 10);
            assert_eq!(skipped_bytes, 0);
        }
        ProduceSummary::NoBytesAvailable { .. } | ProduceSummary::Done { .. } => {
            panic!("Summary should be Processed but got {summary:?}");
        }
    }

    let records = collector.get_records();
    assert_eq!(records.len(), 1);
    assert!(matches!(
        records[0],
        ParseYield::Message(MockMessage { content: 1 })
    ));
    records.clear();

    // Then three parse errors should happen internally with one byte dropped from source
    // then load will be called providing 10 bytes which will be consumed by next parser call.

    // Second Message with content should be yielded consuming 10 the bytes.
    let summary = producer.produce_next(&mut collector).await.unwrap();
    match summary {
        ProduceSummary::Processed {
            bytes_consumed,
            messages_count,
            skipped_bytes,
        } => {
            assert_eq!(messages_count, 1);
            assert_eq!(bytes_consumed, 10);
            assert_eq!(skipped_bytes, 3);
        }
        ProduceSummary::NoBytesAvailable { .. } | ProduceSummary::Done { .. } => {
            panic!("Summary should be Processed but got {summary:?}");
        }
    }

    let records = collector.get_records();
    assert_eq!(records.len(), 1);
    assert!(matches!(
        records[0],
        ParseYield::Message(MockMessage { content: 2 })
    ));

    records.clear();

    // Internal byte source must be empty
    assert_eq!(producer.byte_source.len(), 0);

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

    assert_eq!(collector.get_records().len(), 0);
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
            Ok(None),
        ],
    );

    let mut producer = MessageProducer::new(parser, source);
    let mut collector = GeneralLogCollector::default();

    // Message with content should be yielded consuming all the bytes.
    let summary = producer.produce_next(&mut collector).await.unwrap();
    match summary {
        ProduceSummary::Processed {
            bytes_consumed,
            messages_count,
            skipped_bytes,
        } => {
            assert_eq!(messages_count, 1);
            assert_eq!(bytes_consumed, 10);
            assert_eq!(skipped_bytes, 0);
        }
        ProduceSummary::NoBytesAvailable { .. } | ProduceSummary::Done { .. } => {
            panic!("Summary should be Processed but got {summary:?}");
        }
    }

    let records = collector.get_records();
    assert_eq!(records.len(), 1);
    assert!(matches!(
        records[0],
        ParseYield::Message(MockMessage { content: 1 })
    ));

    records.clear();

    // Then three parse errors should happen internally with one byte dropped from source
    // then load will be called providing no new bytes causing the producer to return the last
    // parse error.

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

    assert_eq!(collector.get_records().len(), 0);
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

    let mut producer = MessageProducer::new(parser, source);
    let mut collector = GeneralLogCollector::default();

    // Message with content should be yielded consuming all the bytes.
    let summary = producer.produce_next(&mut collector).await.unwrap();
    match summary {
        ProduceSummary::Processed {
            bytes_consumed,
            messages_count,
            skipped_bytes,
        } => {
            assert_eq!(messages_count, 1);
            assert_eq!(bytes_consumed, 10);
            assert_eq!(skipped_bytes, 0);
        }
        ProduceSummary::NoBytesAvailable { .. } | ProduceSummary::Done { .. } => {
            panic!("Summary should be Processed but got {summary:?}");
        }
    }

    let records = collector.get_records();
    assert_eq!(records.len(), 1);
    assert!(matches!(
        records[0],
        ParseYield::Message(MockMessage { content: 1 })
    ));

    // Then three parse errors should happen internally with one byte dropped from source
    // then load will be called returning an error causing the producer to return it
    // leading the session to end.

    let res = producer.produce_next(&mut collector).await;
    assert!(res.is_err_and(|err| matches!(err, ProduceError::SourceError(..))));
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

    let mut producer = MessageProducer::new(parser, source);
    let mut collector = GeneralLogCollector::default();

    // Message with content 1 should be yielded considering skipped bytes
    let summary = producer.produce_next(&mut collector).await.unwrap();
    match summary {
        ProduceSummary::Processed {
            bytes_consumed,
            messages_count,
            skipped_bytes,
        } => {
            assert_eq!(messages_count, 1);
            assert_eq!(bytes_consumed, 3);
            assert_eq!(skipped_bytes, 4);
        }
        ProduceSummary::NoBytesAvailable { .. } | ProduceSummary::Done { .. } => {
            panic!("Summary should be Processed but got {summary:?}");
        }
    }

    let records = collector.get_records();
    assert_eq!(records.len(), 1);
    assert!(matches!(
        records[0],
        ParseYield::Message(MockMessage { content: 1 })
    ));
    records.clear();

    // Skipped Message should be yielded considering skipped bytes
    let summary = producer.produce_next(&mut collector).await.unwrap();
    match summary {
        ProduceSummary::Processed {
            bytes_consumed,
            messages_count,
            skipped_bytes,
        } => {
            assert_eq!(messages_count, 0);
            assert_eq!(bytes_consumed, 2);
            assert_eq!(skipped_bytes, 6);
        }
        ProduceSummary::NoBytesAvailable { .. } | ProduceSummary::Done { .. } => {
            panic!("Summary should be Processed but got {summary:?}");
        }
    }

    assert_eq!(collector.get_records().len(), 0);

    // Consume the remaining bytes with skipped parse.
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

    assert_eq!(collector.get_records().len(), 0);
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

    let mut producer = MessageProducer::new(parser, source);
    let mut collector = GeneralLogCollector::default();

    // First successful parse
    let summary = producer.produce_next(&mut collector).await.unwrap();
    match summary {
        ProduceSummary::Processed {
            bytes_consumed,
            messages_count,
            skipped_bytes,
        } => {
            assert_eq!(messages_count, 1);
            assert_eq!(bytes_consumed, 5);
            assert_eq!(skipped_bytes, 3);
        }
        ProduceSummary::NoBytesAvailable { .. } | ProduceSummary::Done { .. } => {
            panic!("Summary should be Processed but got {summary:?}");
        }
    }

    let records = collector.get_records();
    assert_eq!(records.len(), 1);
    assert!(matches!(
        records[0],
        ParseYield::Message(MockMessage { content: 1 })
    ));
    records.clear();

    // One error then successful parse
    // Second successful parse
    let summary = producer.produce_next(&mut collector).await.unwrap();
    match summary {
        ProduceSummary::Processed {
            bytes_consumed,
            messages_count,
            skipped_bytes,
        } => {
            assert_eq!(messages_count, 1);
            assert_eq!(bytes_consumed, 5);
            assert_eq!(skipped_bytes, 4);
        }
        ProduceSummary::NoBytesAvailable { .. } | ProduceSummary::Done { .. } => {
            panic!("Summary should be Processed but got {summary:?}");
        }
    }

    let records = collector.get_records();
    assert_eq!(records.len(), 1);
    assert!(matches!(
        records[0],
        ParseYield::Message(MockMessage { content: 2 })
    ));
    records.clear();

    // Load doesn't have provide new bytes but it still have some available.
    // Third successful parse
    let summary = producer.produce_next(&mut collector).await.unwrap();
    match summary {
        ProduceSummary::Processed {
            bytes_consumed,
            messages_count,
            skipped_bytes,
        } => {
            assert_eq!(messages_count, 1);
            assert_eq!(bytes_consumed, 9);
            assert_eq!(skipped_bytes, 0);
        }
        ProduceSummary::NoBytesAvailable { .. } | ProduceSummary::Done { .. } => {
            panic!("Summary should be Processed but got {summary:?}");
        }
    }

    let records = collector.get_records();
    assert_eq!(records.len(), 1);
    assert!(matches!(
        records[0],
        ParseYield::Message(MockMessage { content: 3 })
    ));

    records.clear();

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

    assert_eq!(collector.get_records().len(), 0);
}
