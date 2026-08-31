//! Tests for the synchronous parsing half of the producer.
//!
//! [`MessageProducer::process()`] never loads, so most of the decision table can be driven
//! without a runtime at all: `MockByteSource::new(init_len, [])` starts with bytes already in
//! its buffer and panics if `load()` is called. The few cases whose outcome depends on the
//! preceding [`MessageProducer::fetch()`] call use a runtime and do fetch for real.
//!
//! `process()` takes its [`FetchInfo`] by value, and the type has no public constructor outside
//! of `fetch()`. The cases below that don't depend on the preceding fetch still need a value to
//! pass in, so they use [`empty_fetch_info()`], built directly from a sibling module: unlike
//! external callers, tests are free to construct one without going through a real `fetch()`.

use std::assert_matches;

use super::mock_byte_source::*;
use super::mock_parser::*;
use super::*;

use parsers::{Error as ParseError, ParseYield, RemainderError};

/// Synthesizes a [`FetchInfo`] as if nothing had been fetched, for decision-table cases whose
/// outcome does not depend on the preceding fetch.
fn empty_fetch_info() -> FetchInfo {
    FetchInfo {
        newly_loaded_bytes: 0,
        skipped_bytes: 0,
    }
}

#[test]
fn no_data_on_empty_source() {
    let parser = MockParser::new([]);
    let source = MockByteSource::new(0, []);

    let mut producer = MessageProducer::new(parser, source);
    let mut collector = GeneralLogCollector::default();

    // Parse must not be called at all when the source holds no bytes.
    let outcome = producer
        .process(empty_fetch_info(), &mut collector)
        .unwrap();
    assert!(matches!(outcome, ProcessOutcome::NoData));

    assert!(collector.get_records().is_empty());
}

#[test]
fn parsed_appends_items_and_consumes_bytes() {
    let parser = MockParser::new([Ok(vec![MockParseSeed::new(
        4,
        Some(ParseYield::Message(MockMessage::from(1))),
    )])]);
    let source = MockByteSource::new(10, []);

    let mut producer = MessageProducer::new(parser, source);
    let mut collector = GeneralLogCollector::default();

    let outcome = producer
        .process(empty_fetch_info(), &mut collector)
        .unwrap();
    match outcome {
        ProcessOutcome::Parsed {
            bytes_consumed,
            messages_count,
            skipped_bytes,
        } => {
            assert_eq!(bytes_consumed, 4);
            assert_eq!(messages_count, 1);
            assert_eq!(skipped_bytes, 0);
        }
        invalid => panic!("Outcome should be Parsed but got {invalid:?}"),
    }

    let records = collector.get_records();
    assert_eq!(records.len(), 1);
    assert!(matches!(
        records[0],
        ParseYield::Message(MockMessage { content: 1 })
    ));

    // Only the parsed bytes must be consumed from the source.
    assert_eq!(producer.byte_source.len(), 6);
    assert_eq!(producer.total_produced_items(), 1);
}

#[test]
fn parsed_counts_bytes_skipped_by_parser() {
    let parser = MockParser::new([Ok(vec![MockParseSeed::new(4, None)])]);
    let source = MockByteSource::new(10, []);

    let mut producer = MessageProducer::new(parser, source);
    let mut collector = GeneralLogCollector::default();

    let outcome = producer
        .process(empty_fetch_info(), &mut collector)
        .unwrap();
    match outcome {
        ProcessOutcome::Parsed {
            bytes_consumed,
            messages_count,
            skipped_bytes,
        } => {
            assert_eq!(bytes_consumed, 4);
            assert_eq!(messages_count, 0);
            assert_eq!(skipped_bytes, 4);
        }
        invalid => panic!("Outcome should be Parsed but got {invalid:?}"),
    }

    assert!(collector.get_records().is_empty());

    // Bytes skipped by the parser belong to the producer totals too.
    assert_eq!(producer.total_skipped_bytes(), 4);
}

#[tokio::test]
async fn incomplete_after_productive_fetch_asks_for_more_bytes() {
    let parser = MockParser::new([Err(ParseError::Incomplete)]);
    let source = MockByteSource::new(0, [Ok(Some(MockReloadSeed::new(10, 0)))]);

    let mut producer = MessageProducer::new(parser, source);
    let mut collector = GeneralLogCollector::default();

    let fetch_info = producer.fetch().await.unwrap();

    // The source is still delivering, so the incomplete message must not be resynced away.
    let outcome = producer.process(fetch_info, &mut collector).unwrap();
    assert!(matches!(outcome, ProcessOutcome::NeedMoreBytes));

    assert_eq!(producer.byte_source.len(), 10);
    assert_eq!(producer.total_skipped_bytes(), 0);
    assert!(collector.get_records().is_empty());
}

#[test]
fn incomplete_without_new_bytes_keeps_remainder() {
    let parser = MockParser::new([Err(ParseError::Incomplete)]);
    let source = MockByteSource::new(3, []);

    let mut producer = MessageProducer::new(parser, source);
    let mut collector = GeneralLogCollector::default();

    // The source is only paused: the bytes are the start of an item and must survive until it
    // either delivers the rest or the caller declares the source finished.
    let outcome = producer
        .process(empty_fetch_info(), &mut collector)
        .unwrap();
    assert_matches!(outcome, ProcessOutcome::PendingRemainder);

    assert_eq!(producer.byte_source.len(), 3);
    assert_eq!(producer.total_skipped_bytes(), 0);
    assert!(collector.get_records().is_empty());
}

#[test]
fn full_source_emits_remainder() {
    let parser = MockParser::new([Err(ParseError::Incomplete)])
        .with_remainder_seeds([Ok(Some(ParseYield::Message(MockMessage::from(1))))]);
    let source = MockByteSource::new(3, []).buffer_full();

    let mut producer = MessageProducer::new(parser, source);
    let mut collector = GeneralLogCollector::default();

    // Waiting for bytes that a full buffer can't take would stall forever, so the parser gets
    // to close the item now. It covers the whole buffer by definition.
    let outcome = producer
        .process(empty_fetch_info(), &mut collector)
        .unwrap();
    match outcome {
        ProcessOutcome::Parsed {
            bytes_consumed,
            messages_count,
            skipped_bytes,
        } => {
            assert_eq!(bytes_consumed, 3);
            assert_eq!(messages_count, 1);
            assert_eq!(skipped_bytes, 0);
        }
        invalid => panic!("Outcome should be Parsed but got {invalid:?}"),
    }

    assert_eq!(collector.get_records().len(), 1);
    assert_eq!(producer.byte_source.len(), 0);
    assert_eq!(producer.total_produced_items(), 1);
}

#[test]
fn full_source_drops_bytes_without_remainder() {
    let parser = MockParser::new([
        Err(ParseError::Incomplete),
        Err(ParseError::Incomplete),
        Err(ParseError::Incomplete),
    ])
    .with_remainder_seeds([Ok(None), Ok(None), Ok(None)]);
    let source = MockByteSource::new(3, []).buffer_full();

    let mut producer = MessageProducer::new(parser, source);
    let mut collector = GeneralLogCollector::default();

    // A parser which can't complete a partial item leaves the producer with the resync it had
    // before: one byte dropped per parse call until the buffer is empty.
    let outcome = producer
        .process(empty_fetch_info(), &mut collector)
        .unwrap();
    assert_matches!(outcome, ProcessOutcome::NoData);

    assert_eq!(producer.byte_source.len(), 0);
    assert_eq!(producer.total_skipped_bytes(), 3);
    assert!(collector.get_records().is_empty());
}

#[test]
fn full_source_parse_error_resyncs_then_reports() {
    let parser = MockParser::new([Err(ParseError::Incomplete), Err(ParseError::Incomplete)])
        .with_remainder_seeds([
            Err(RemainderError::Parse(String::from("broken"))),
            Err(RemainderError::Parse(String::from("broken"))),
        ]);
    let source = MockByteSource::new(2, []).buffer_full();

    let mut producer = MessageProducer::new(parser, source);
    let mut collector = GeneralLogCollector::default();

    // Rejecting the remainder funnels into the resync path: bytes are dropped and the message
    // is delivered once the buffer ran dry.
    let err = producer
        .process(empty_fetch_info(), &mut collector)
        .unwrap_err();
    assert_matches!(err, ProcessError::Parse(_));

    assert_eq!(producer.byte_source.len(), 0);
    assert_eq!(producer.total_skipped_bytes(), 2);
}

#[test]
fn full_source_unrecoverable_ends_producer() {
    let parser = MockParser::new([Err(ParseError::Incomplete)])
        .with_remainder_seeds([Err(RemainderError::Unrecoverable(String::from("fatal")))]);
    let source = MockByteSource::new(3, []).buffer_full();

    let mut producer = MessageProducer::new(parser, source);
    let mut collector = GeneralLogCollector::default();

    let err = producer
        .process(empty_fetch_info(), &mut collector)
        .unwrap_err();
    assert_matches!(err, ProcessError::Unrecoverable(_));

    let outcome = producer
        .process(empty_fetch_info(), &mut collector)
        .unwrap();
    assert_matches!(outcome, ProcessOutcome::Done);
}

#[test]
fn process_remaining_emits_item() {
    let parser = MockParser::new([])
        .with_remainder_seeds([Ok(Some(ParseYield::Message(MockMessage::from(1))))]);
    let source = MockByteSource::new(4, []);

    let mut producer = MessageProducer::new(parser, source);
    let mut collector = GeneralLogCollector::default();

    assert_eq!(producer.process_remaining(&mut collector).unwrap(), 1);

    assert_eq!(collector.get_records().len(), 1);
    assert_eq!(producer.byte_source.len(), 0);
    assert_eq!(producer.total_produced_items(), 1);
}

#[test]
fn process_remaining_keeps_bytes_without_item() {
    let parser = MockParser::new([]).with_remainder_seeds([Ok(None)]);
    let source = MockByteSource::new(4, []);

    let mut producer = MessageProducer::new(parser, source);
    let mut collector = GeneralLogCollector::default();

    // A stalled source is not a finished one: discarding here would make a parser waiting for
    // the rest of a message resume in the middle of it.
    assert_eq!(producer.process_remaining(&mut collector).unwrap(), 0);

    assert_eq!(producer.byte_source.len(), 4);
    assert_eq!(producer.total_skipped_bytes(), 0);
    assert!(collector.get_records().is_empty());
}

#[test]
fn process_remaining_reports_parse_error_without_consuming() {
    let parser = MockParser::new([])
        .with_remainder_seeds([Err(RemainderError::Parse(String::from("broken")))]);
    let source = MockByteSource::new(4, []);

    let mut producer = MessageProducer::new(parser, source);
    let mut collector = GeneralLogCollector::default();

    let err = producer.process_remaining(&mut collector).unwrap_err();
    assert_matches!(err, ProcessError::Parse(_));

    assert_eq!(producer.byte_source.len(), 4);
}

#[test]
fn process_remaining_is_idempotent() {
    let parser = MockParser::new([])
        .with_remainder_seeds([Ok(Some(ParseYield::Message(MockMessage::from(1))))]);
    let source = MockByteSource::new(4, []);

    let mut producer = MessageProducer::new(parser, source);
    let mut collector = GeneralLogCollector::default();

    assert_eq!(producer.process_remaining(&mut collector).unwrap(), 1);

    // Consuming the remainder is what makes the second call a no-op: no seed is left, so the
    // parser would panic if it were called again.
    assert_eq!(producer.process_remaining(&mut collector).unwrap(), 0);
    assert_eq!(collector.get_records().len(), 1);
}

#[tokio::test]
async fn remainder_survives_empty_result_and_completes_later() {
    let parser = MockParser::new([
        Err(ParseError::Incomplete),
        Ok(vec![MockParseSeed::new(
            7,
            Some(ParseYield::Message(MockMessage::from(1))),
        )]),
    ])
    .with_remainder_seeds([Ok(None)]);
    let source = MockByteSource::new(4, [Ok(Some(MockReloadSeed::new(3, 0)))]);

    let mut producer = MessageProducer::new(parser, source);
    let mut collector = GeneralLogCollector::default();

    // The source went quiet mid-item and the parser can't complete it yet.
    let outcome = producer
        .process(empty_fetch_info(), &mut collector)
        .unwrap();
    assert_matches!(outcome, ProcessOutcome::PendingRemainder);
    assert_eq!(producer.process_remaining(&mut collector).unwrap(), 0);

    // The kept bytes are the head of the item, so it parses whole once the source resumes.
    let fetch_info = producer.fetch().await.unwrap();
    let outcome = producer.process(fetch_info, &mut collector).unwrap();
    match outcome {
        ProcessOutcome::Parsed {
            bytes_consumed,
            messages_count,
            ..
        } => {
            assert_eq!(bytes_consumed, 7);
            assert_eq!(messages_count, 1);
        }
        invalid => panic!("Outcome should be Parsed but got {invalid:?}"),
    }
}

#[test]
fn parse_error_resyncs_then_parses() {
    let parser = MockParser::new([
        Err(ParseError::Parse(String::from("broken"))),
        Err(ParseError::Parse(String::from("broken"))),
        Ok(vec![MockParseSeed::new(
            3,
            Some(ParseYield::Message(MockMessage::from(1))),
        )]),
    ]);
    let source = MockByteSource::new(5, []);

    let mut producer = MessageProducer::new(parser, source);
    let mut collector = GeneralLogCollector::default();

    let outcome = producer
        .process(empty_fetch_info(), &mut collector)
        .unwrap();
    match outcome {
        ProcessOutcome::Parsed {
            bytes_consumed,
            messages_count,
            skipped_bytes,
        } => {
            assert_eq!(bytes_consumed, 3);
            assert_eq!(messages_count, 1);
            // The two bytes dropped while resyncing.
            assert_eq!(skipped_bytes, 2);
        }
        invalid => panic!("Outcome should be Parsed but got {invalid:?}"),
    }

    assert_eq!(collector.get_records().len(), 1);
    assert_eq!(producer.byte_source.len(), 0);
    assert_eq!(producer.total_skipped_bytes(), 2);
}

#[test]
fn parse_error_is_delivered_when_source_is_dry() {
    let parser = MockParser::new([
        Err(ParseError::Parse(String::from("broken"))),
        Err(ParseError::Parse(String::from("broken"))),
    ]);
    let source = MockByteSource::new(2, []);

    let mut producer = MessageProducer::new(parser, source);
    let mut collector = GeneralLogCollector::default();

    // Nothing was fetched and resyncing drained the buffer: the last parse error is the result.
    let err = producer
        .process(empty_fetch_info(), &mut collector)
        .unwrap_err();
    assert!(matches!(err, ProcessError::Parse(msg) if msg == "broken"));

    assert_eq!(producer.byte_source.len(), 0);
    assert_eq!(producer.total_skipped_bytes(), 2);
}

#[tokio::test]
async fn parse_error_asks_for_more_bytes_while_source_delivers() {
    let parser = MockParser::new([
        Err(ParseError::Parse(String::from("broken"))),
        Err(ParseError::Parse(String::from("broken"))),
    ]);
    let source = MockByteSource::new(0, [Ok(Some(MockReloadSeed::new(2, 0))), Ok(None)]);

    let mut producer = MessageProducer::new(parser, source);
    let mut collector = GeneralLogCollector::default();

    let fetch_info = producer.fetch().await.unwrap();

    // Resyncing drained the buffer but the last fetch was productive: ask for more bytes
    // instead of ending the session on the parse error.
    let outcome = producer.process(fetch_info, &mut collector).unwrap();
    assert!(matches!(outcome, ProcessOutcome::NeedMoreBytes));
    assert_eq!(producer.byte_source.len(), 0);

    // Once the source has nothing more to give, the remembered error is delivered.
    let fetch_info = producer.fetch().await.unwrap();
    let err = producer.process(fetch_info, &mut collector).unwrap_err();
    assert!(matches!(err, ProcessError::Parse(msg) if msg == "broken"));

    assert_eq!(producer.total_skipped_bytes(), 2);
}

#[tokio::test]
async fn stale_parse_error_isnt_reported() {
    // A parse error is remembered while resyncing so it can be delivered once the source runs
    // dry. Once the parser starts asking for more bytes instead of rejecting them, that error
    // no longer describes why the producer is stuck and must be forgotten: running dry then
    // means "no data", not "parse error".
    let parser = MockParser::new([
        Err(ParseError::Parse(String::from("stale"))),
        Err(ParseError::Parse(String::from("stale"))),
        Err(ParseError::Incomplete),
        Err(ParseError::Incomplete),
    ]);
    let source = MockByteSource::new(
        0,
        [
            Ok(Some(MockReloadSeed::new(2, 0))),
            Ok(Some(MockReloadSeed::new(3, 0))),
            Ok(None),
        ],
    );

    let mut producer = MessageProducer::new(parser, source);
    let mut collector = GeneralLogCollector::default();

    // Both bytes are dropped resyncing from the parse error, which is kept pending because the
    // source is still delivering.
    let fetch_info = producer.fetch().await.unwrap();
    let outcome = producer.process(fetch_info, &mut collector).unwrap();
    assert!(matches!(outcome, ProcessOutcome::NeedMoreBytes));

    // The freshly loaded bytes only make the parser ask for more, superseding the parse error.
    let fetch_info = producer.fetch().await.unwrap();
    let outcome = producer.process(fetch_info, &mut collector).unwrap();
    assert!(matches!(outcome, ProcessOutcome::NeedMoreBytes));

    // The source is dry now: the pending bytes are kept for the caller to resolve, and no
    // error is reported, least of all the one from the very first call.
    let fetch_info = producer.fetch().await.unwrap();
    let outcome = producer.process(fetch_info, &mut collector).unwrap();
    assert_matches!(outcome, ProcessOutcome::PendingRemainder);

    assert!(collector.get_records().is_empty());
}

#[test]
fn eof_marks_producer_done() {
    let parser = MockParser::new([Err(ParseError::Eof)]);
    let source = MockByteSource::new(5, []);

    let mut producer = MessageProducer::new(parser, source);
    let mut collector = GeneralLogCollector::default();

    let outcome = producer
        .process(empty_fetch_info(), &mut collector)
        .unwrap();
    assert!(matches!(outcome, ProcessOutcome::Done));

    // The producer stays done: parse must not be called again (no seeds are left).
    let outcome = producer
        .process(empty_fetch_info(), &mut collector)
        .unwrap();
    assert!(matches!(outcome, ProcessOutcome::Done));
}

#[test]
fn unrecoverable_parse_error_marks_producer_done() {
    let parser = MockParser::new([Err(ParseError::Unrecoverable(String::from("fatal")))]);
    let source = MockByteSource::new(5, []);

    let mut producer = MessageProducer::new(parser, source);
    let mut collector = GeneralLogCollector::default();

    let err = producer
        .process(empty_fetch_info(), &mut collector)
        .unwrap_err();
    assert!(matches!(err, ProcessError::Unrecoverable(msg) if msg == "fatal"));

    let outcome = producer
        .process(empty_fetch_info(), &mut collector)
        .unwrap();
    assert!(matches!(outcome, ProcessOutcome::Done));
}

#[test]
fn initial_parse_errors_abort_the_session() {
    // The guard trips once more bytes than `INITIAL_PARSE_ERROR_LIMIT` have been dropped
    // while resyncing, without a single item being produced.
    const PARSE_CALLS: usize = INITIAL_PARSE_ERROR_LIMIT + 2;

    let parse_seeds: Vec<_> = std::iter::repeat_with(|| Err(ParseError::Parse(String::new())))
        .take(PARSE_CALLS)
        .collect();
    let parser = MockParser::new(parse_seeds);
    let source = MockByteSource::new(PARSE_CALLS, []);

    let mut producer = MessageProducer::new(parser, source);
    let mut collector = GeneralLogCollector::default();

    let err = producer
        .process(empty_fetch_info(), &mut collector)
        .unwrap_err();
    assert!(matches!(err, ProcessError::Unrecoverable(..)));

    // Aborting is final.
    let outcome = producer
        .process(empty_fetch_info(), &mut collector)
        .unwrap();
    assert!(matches!(outcome, ProcessOutcome::Done));
}

#[tokio::test]
async fn source_skips_dont_abort_the_session() {
    // Sources report the bytes they skip on their own: pcap sources report the headers of every
    // packet, and the whole payload of a packet rejected by the filter. Those bytes say nothing
    // about the parser failing to make progress and must not spend the abort budget, no matter
    // how far past `INITIAL_PARSE_ERROR_LIMIT` they take the skipped totals.
    const SOURCE_SKIPPED: usize = INITIAL_PARSE_ERROR_LIMIT * 2;

    let parser = MockParser::new([
        Err(ParseError::Parse(String::from("broken"))),
        Ok(vec![MockParseSeed::new(
            9,
            Some(ParseYield::Message(MockMessage::from(1))),
        )]),
    ]);
    let source = MockByteSource::new(0, [Ok(Some(MockReloadSeed::new(10, SOURCE_SKIPPED)))]);

    let mut producer = MessageProducer::new(parser, source);
    let mut collector = GeneralLogCollector::default();

    let fetch_info = producer.fetch().await.unwrap();
    assert!(producer.total_skipped_bytes() > INITIAL_PARSE_ERROR_LIMIT);

    // The single parse error must resync by dropping one byte and carry on, not end the session.
    let outcome = producer.process(fetch_info, &mut collector).unwrap();
    match outcome {
        ProcessOutcome::Parsed {
            bytes_consumed,
            messages_count,
            skipped_bytes,
        } => {
            assert_eq!(bytes_consumed, 9);
            assert_eq!(messages_count, 1);
            assert_eq!(skipped_bytes, 1);
        }
        invalid => panic!("Outcome should be Parsed but got {invalid:?}"),
    }

    assert_eq!(collector.get_records().len(), 1);
}

#[tokio::test]
async fn fetch_on_done_producer_leaves_source_untouched() {
    let parser = MockParser::new([Err(ParseError::Eof)]);
    // No reload seeds: the mock source panics if `load()` is called.
    let source = MockByteSource::new(5, []);

    let mut producer = MessageProducer::new(parser, source);
    let mut collector = GeneralLogCollector::default();

    assert!(matches!(
        producer
            .process(empty_fetch_info(), &mut collector)
            .unwrap(),
        ProcessOutcome::Done
    ));

    let fetch_info = producer.fetch().await.unwrap();
    assert_eq!(fetch_info.newly_loaded_bytes, 0);
    assert_eq!(fetch_info.skipped_bytes, 0);
}
