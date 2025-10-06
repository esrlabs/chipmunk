use std::time::Duration;

use mock_byte_source::*;
use mock_parser::*;
use parsers::{Error as ParseError, ParseYield};
use tokio::time::{sleep, timeout};

use super::*;

const SOURCE_SLEEP_DURATION: Duration = Duration::from_millis(70);

/// Cancel safety test for producer session without parse errors.
#[tokio::test]
async fn cancel_safe_no_errors() {
    let parser = MockParser::new([
        Ok(vec![MockParseSeed::new(
            5,
            Some(ParseYield::Message(MockMessage::from(1))),
        )]),
        Ok(vec![MockParseSeed::new(
            4,
            Some(ParseYield::Message(MockMessage::from(2))),
        )]),
        Ok(vec![MockParseSeed::new(
            6,
            Some(ParseYield::Message(MockMessage::from(3))),
        )]),
    ]);

    let source = MockByteSource::new(
        0,
        [
            Ok(Some(
                MockReloadSeed::new(5, 0).sleep_duration(SOURCE_SLEEP_DURATION),
            )),
            Ok(Some(
                MockReloadSeed::new(4, 0).sleep_duration(SOURCE_SLEEP_DURATION),
            )),
            Ok(Some(
                MockReloadSeed::new(6, 0).sleep_duration(SOURCE_SLEEP_DURATION),
            )),
            Ok(None),
            Ok(None),
        ],
    );

    let mut producer = MessageProducer::new(parser, source);
    let (cancel_tx, mut cancel_rx) = tokio::sync::mpsc::channel(32);

    let cancel_handle = tokio::spawn(async move {
        let mut count = 0;
        while cancel_tx.send(()).await.is_ok() {
            sleep(Duration::from_millis(2)).await;
            count += 1;
        }

        assert!(count > 50);
    });

    let mut cancel_received = 0;
    let mut read_idx = 0;
    let mut collector = GeneralLogCollector::default();
    loop {
        collector.get_records().clear();
        tokio::select! {
            _ = cancel_rx.recv() => {
                cancel_received += 1;
            }
            res = producer.produce_next(&mut collector) => {
                match read_idx {
                    0 => {
                        let res = res.unwrap();
                        assert!(matches!(res, ProduceSummary::Processed{..}));
                        let items = collector.get_records();
                        assert_eq!(items.len(), 1);
                        assert!(matches!(items[0], ParseYield::Message(MockMessage { content: 1 })));
                    },
                    1 => {
                        let res = res.unwrap();
                        assert!(matches!(res, ProduceSummary::Processed{..}));
                        let items = collector.get_records();
                        assert_eq!(items.len(), 1);
                        assert!(matches!(items[0], ParseYield::Message(MockMessage { content: 2 })));
                    },
                    2 => {
                        let res = res.unwrap();
                        assert!(matches!(res, ProduceSummary::Processed{..}));
                        let items = collector.get_records();
                        assert_eq!(items.len(), 1);
                        assert!(matches!(items[0], ParseYield::Message(MockMessage { content: 3 })));
                    },
                    3 => {
                        let res = res.unwrap();
                        assert!(matches!(res, ProduceSummary::NoBytesAvailable{..}));
                        let items = collector.get_records();
                        assert_eq!(items.len(), 0);
                        break;
                    },
                    _invalid => panic!("Unexpected read_next_segment() results. Idx: {_invalid}"),

                };
                read_idx += 1;
            }
        };
    }
    drop(cancel_rx);

    assert!(cancel_received > 50);

    assert!(cancel_handle.await.is_ok());
}

/// Cancel safety test for producer session with parse incomplete errors.
#[tokio::test]
async fn cancel_safe_incomplete() {
    let parser = MockParser::new([
        Ok(vec![MockParseSeed::new(
            5,
            Some(ParseYield::Message(MockMessage::from(1))),
        )]),
        Ok(vec![MockParseSeed::new(
            4,
            Some(ParseYield::Message(MockMessage::from(2))),
        )]),
        Err(ParseError::Incomplete),
        Err(ParseError::Incomplete),
        Ok(vec![MockParseSeed::new(
            18, // 6 + 6 + 6 bytes from load calls on byte source below.
            Some(ParseYield::Message(MockMessage::from(3))),
        )]),
    ]);

    let source = MockByteSource::new(
        0,
        [
            Ok(Some(
                MockReloadSeed::new(5, 0).sleep_duration(SOURCE_SLEEP_DURATION),
            )),
            Ok(Some(
                MockReloadSeed::new(4, 0).sleep_duration(SOURCE_SLEEP_DURATION),
            )),
            Ok(Some(
                MockReloadSeed::new(6, 0).sleep_duration(SOURCE_SLEEP_DURATION),
            )),
            Ok(Some(
                MockReloadSeed::new(6, 0).sleep_duration(SOURCE_SLEEP_DURATION),
            )),
            Ok(Some(
                MockReloadSeed::new(6, 0).sleep_duration(SOURCE_SLEEP_DURATION),
            )),
            Ok(None),
        ],
    );

    let mut producer = MessageProducer::new(parser, source);
    let (cancel_tx, mut cancel_rx) = tokio::sync::mpsc::channel(32);

    let cancel_handle = tokio::spawn(async move {
        let mut count = 0;
        while cancel_tx.send(()).await.is_ok() {
            sleep(Duration::from_millis(2)).await;
            count += 1;
        }

        assert!(count > 50);
    });

    let mut cancel_received = 0;
    let mut read_idx = 0;
    let mut collector = GeneralLogCollector::default();
    loop {
        collector.get_records().clear();
        tokio::select! {
            _ = cancel_rx.recv() => {
                cancel_received += 1;
            }
            res = producer.produce_next(&mut collector) => {
                match read_idx {
                    0 => {
                        let res = res.unwrap();
                        assert!(matches!(res, ProduceSummary::Processed{..}));
                        let items = collector.get_records();
                        assert_eq!(items.len(), 1);
                        assert!(matches!(items[0], ParseYield::Message(MockMessage { content: 1 })));
                    },
                    1 => {
                        let res = res.unwrap();
                        assert!(matches!(res, ProduceSummary::Processed{..}));
                        let items = collector.get_records();
                        assert_eq!(items.len(), 1);
                        assert!(matches!(items[0], ParseYield::Message(MockMessage { content: 2 })));
                    },
                    2 => {
                        let res = res.unwrap();
                        assert!(matches!(res, ProduceSummary::Processed{..}));
                        let items = collector.get_records();
                        assert_eq!(items.len(), 1);
                        assert!(matches!(items[0], ParseYield::Message(MockMessage { content: 3 })));
                    },
                    3 => {
                        let res = res.unwrap();
                        assert!(matches!(res, ProduceSummary::NoBytesAvailable{..}));
                        let items = collector.get_records();
                        assert_eq!(items.len(), 0);
                        break;
                    },
                    _invalid => panic!("Unexpected read_next_segment() results. Idx: {_invalid}"),

                };
                read_idx += 1;
            }
        };
    }
    drop(cancel_rx);

    assert!(cancel_received > 50);

    assert!(cancel_handle.await.is_ok());
}

/// Cancel safety test for producer session with parse end of file error.
#[tokio::test]
async fn cancel_safe_eof() {
    let parser = MockParser::new([
        Ok(vec![MockParseSeed::new(
            5,
            Some(ParseYield::Message(MockMessage::from(1))),
        )]),
        Ok(vec![MockParseSeed::new(
            4,
            Some(ParseYield::Message(MockMessage::from(2))),
        )]),
        Ok(vec![MockParseSeed::new(
            6,
            Some(ParseYield::Message(MockMessage::from(3))),
        )]),
        Err(ParseError::Eof),
    ]);

    let source = MockByteSource::new(
        0,
        [
            Ok(Some(
                MockReloadSeed::new(5, 0).sleep_duration(SOURCE_SLEEP_DURATION),
            )),
            Ok(Some(
                MockReloadSeed::new(4, 0).sleep_duration(SOURCE_SLEEP_DURATION),
            )),
            Ok(Some(
                MockReloadSeed::new(6, 0).sleep_duration(SOURCE_SLEEP_DURATION),
            )),
            Ok(None),
        ],
    );

    let mut producer = MessageProducer::new(parser, source);
    let (cancel_tx, mut cancel_rx) = tokio::sync::mpsc::channel(32);

    let cancel_handle = tokio::spawn(async move {
        let mut count = 0;
        while cancel_tx.send(()).await.is_ok() {
            sleep(Duration::from_millis(2)).await;
            count += 1;
        }

        assert!(count > 50);
    });

    let mut cancel_received = 0;
    let mut read_idx = 0;
    let mut collector = GeneralLogCollector::default();
    loop {
        collector.get_records().clear();
        tokio::select! {
            _ = cancel_rx.recv() => {
                cancel_received += 1;
            }
            res = producer.produce_next(&mut collector) => {
                match read_idx {
                    0 => {
                        let res = res.unwrap();
                        assert!(matches!(res, ProduceSummary::Processed{..}));
                        let items = collector.get_records();
                        assert_eq!(items.len(), 1);
                        assert!(matches!(items[0], ParseYield::Message(MockMessage { content: 1 })));
                    },
                    1 => {
                        let res = res.unwrap();
                        assert!(matches!(res, ProduceSummary::Processed{..}));
                        let items = collector.get_records();
                        assert_eq!(items.len(), 1);
                        assert!(matches!(items[0], ParseYield::Message(MockMessage { content: 2 })));
                    },
                    2 => {
                        let res = res.unwrap();
                        assert!(matches!(res, ProduceSummary::Processed{..}));
                        let items = collector.get_records();
                        assert_eq!(items.len(), 1);
                        assert!(matches!(items[0], ParseYield::Message(MockMessage { content: 3 })));
                    },
                    3 => {
                        let res = res.unwrap();
                        assert!(matches!(res, ProduceSummary::NoBytesAvailable{..}));
                        let items = collector.get_records();
                        assert_eq!(items.len(), 0);
                        break;
                    },
                    _invalid => panic!("Unexpected read_next_segment() results. Idx: {_invalid}"),

                };
                read_idx += 1;
            }
        };
    }
    drop(cancel_rx);

    assert!(cancel_received > 50);

    assert!(cancel_handle.await.is_ok());
}

/// Cancel safety test for producer session with parse errors, without calling load
/// on source because of them.
#[tokio::test]
async fn cancel_safe_parse_err_no_load() {
    let parser = MockParser::new([
        Ok(vec![MockParseSeed::new(
            5,
            Some(ParseYield::Message(MockMessage::from(1))),
        )]),
        Ok(vec![MockParseSeed::new(
            4,
            Some(ParseYield::Message(MockMessage::from(2))),
        )]),
        Err(ParseError::Parse(String::new())),
        Err(ParseError::Parse(String::new())),
        Ok(vec![MockParseSeed::new(
            4, // 6 bytes from load - 2 bytes dropped because of parse errors.
            Some(ParseYield::Message(MockMessage::from(3))),
        )]),
    ]);

    let source = MockByteSource::new(
        0,
        [
            Ok(Some(
                MockReloadSeed::new(5, 0).sleep_duration(SOURCE_SLEEP_DURATION),
            )),
            Ok(Some(
                MockReloadSeed::new(4, 0).sleep_duration(SOURCE_SLEEP_DURATION),
            )),
            Ok(Some(
                MockReloadSeed::new(6, 0).sleep_duration(SOURCE_SLEEP_DURATION),
            )),
            Ok(None),
        ],
    );

    let mut producer = MessageProducer::new(parser, source);
    let (cancel_tx, mut cancel_rx) = tokio::sync::mpsc::channel(32);

    let cancel_handle = tokio::spawn(async move {
        let mut count = 0;
        while cancel_tx.send(()).await.is_ok() {
            sleep(Duration::from_millis(2)).await;
            count += 1;
        }

        assert!(count > 50);
    });

    let mut cancel_received = 0;
    let mut read_idx = 0;
    let mut collector = GeneralLogCollector::default();
    loop {
        collector.get_records().clear();
        tokio::select! {
            _ = cancel_rx.recv() => {
                cancel_received += 1;
            }
            res = producer.produce_next(&mut collector) => {
                match read_idx {
                    0 => {
                        let res = res.unwrap();
                        assert!(matches!(res, ProduceSummary::Processed{..}));
                        let items = collector.get_records();
                        assert_eq!(items.len(), 1);
                        assert!(matches!(items[0], ParseYield::Message(MockMessage { content: 1 })));
                    },
                    1 => {
                        let res = res.unwrap();
                        assert!(matches!(res, ProduceSummary::Processed{..}));
                        let items = collector.get_records();
                        assert_eq!(items.len(), 1);
                        assert!(matches!(items[0], ParseYield::Message(MockMessage { content: 2 })));
                    },
                    2 => {
                        let res = res.unwrap();
                        assert!(matches!(res, ProduceSummary::Processed{..}));
                        let items = collector.get_records();
                        assert_eq!(items.len(), 1);
                        assert!(matches!(items[0], ParseYield::Message(MockMessage { content: 3 })));
                    },
                    3 => {
                        let res = res.unwrap();
                        assert!(matches!(res, ProduceSummary::NoBytesAvailable{..}));
                        let items = collector.get_records();
                        assert_eq!(items.len(), 0);
                        break;
                    },
                    _invalid => panic!("Unexpected read_next_segment() results. Idx: {_invalid}"),

                };
                read_idx += 1;
            }
        };
    }
    drop(cancel_rx);

    assert!(cancel_received > 50);

    assert!(cancel_handle.await.is_ok());
}

/// Cancel safety test for producer session with parse errors, causing to call load
/// on source because of them.
#[tokio::test]
async fn cancel_safe_parse_err_with_load() {
    let parser = MockParser::new([
        Ok(vec![MockParseSeed::new(
            5,
            Some(ParseYield::Message(MockMessage::from(1))),
        )]),
        Ok(vec![MockParseSeed::new(
            4,
            Some(ParseYield::Message(MockMessage::from(2))),
        )]),
        // Drop all 6 bytes from load call causing load to be called again.
        Err(ParseError::Parse(String::new())),
        Err(ParseError::Parse(String::new())),
        Err(ParseError::Parse(String::new())),
        Err(ParseError::Parse(String::new())),
        Err(ParseError::Parse(String::new())),
        Err(ParseError::Parse(String::new())),
        Ok(vec![MockParseSeed::new(
            6,
            Some(ParseYield::Message(MockMessage::from(3))),
        )]),
    ]);

    let source = MockByteSource::new(
        0,
        [
            Ok(Some(
                MockReloadSeed::new(5, 0).sleep_duration(SOURCE_SLEEP_DURATION),
            )),
            Ok(Some(
                MockReloadSeed::new(4, 0).sleep_duration(SOURCE_SLEEP_DURATION),
            )),
            Ok(Some(
                MockReloadSeed::new(6, 0).sleep_duration(SOURCE_SLEEP_DURATION),
            )),
            Ok(Some(
                MockReloadSeed::new(6, 0).sleep_duration(SOURCE_SLEEP_DURATION),
            )),
            Ok(None),
        ],
    );

    let mut producer = MessageProducer::new(parser, source);
    let (cancel_tx, mut cancel_rx) = tokio::sync::mpsc::channel(32);

    let cancel_handle = tokio::spawn(async move {
        let mut count = 0;
        while cancel_tx.send(()).await.is_ok() {
            sleep(Duration::from_millis(2)).await;
            count += 1;
        }

        assert!(count > 50);
    });

    let mut cancel_received = 0;
    let mut read_idx = 0;
    let mut collector = GeneralLogCollector::default();
    loop {
        collector.get_records().clear();
        tokio::select! {
            _ = cancel_rx.recv() => {
                cancel_received += 1;
            }
            res = producer.produce_next(&mut collector) => {
                match read_idx {
                    0 => {
                        let res = res.unwrap();
                        assert!(matches!(res, ProduceSummary::Processed{..}));
                        let items = collector.get_records();
                        assert_eq!(items.len(), 1);
                        assert!(matches!(items[0], ParseYield::Message(MockMessage { content: 1 })));
                    },
                    1 => {
                        let res = res.unwrap();
                        assert!(matches!(res, ProduceSummary::Processed{..}));
                        let items = collector.get_records();
                        assert_eq!(items.len(), 1);
                        assert!(matches!(items[0], ParseYield::Message(MockMessage { content: 2 })));
                    },
                    2 => {
                        let res = res.unwrap();
                        assert!(matches!(res, ProduceSummary::Processed{..}));
                        let items = collector.get_records();
                        assert_eq!(items.len(), 1);
                        assert!(matches!(items[0], ParseYield::Message(MockMessage { content: 3 })));
                    },
                    3 => {
                        let res = res.unwrap();
                        assert!(matches!(res, ProduceSummary::NoBytesAvailable{..}));
                        let items = collector.get_records();
                        assert_eq!(items.len(), 0);
                        break;
                    },
                    _invalid => panic!("Unexpected read_next_segment() results. Idx: {_invalid}"),

                };
                read_idx += 1;
            }
        };
    }
    drop(cancel_rx);

    assert!(cancel_received > 50);

    assert!(cancel_handle.await.is_ok());
}

/// Cancel safety test use no errors using `timeout()` method instead of `select!{}` macro.
#[tokio::test]
async fn cancel_safe_timeout() {
    let parser = MockParser::new([
        Ok(vec![MockParseSeed::new(
            5,
            Some(ParseYield::Message(MockMessage::from(1))),
        )]),
        Ok(vec![MockParseSeed::new(
            4,
            Some(ParseYield::Message(MockMessage::from(2))),
        )]),
        Ok(vec![MockParseSeed::new(
            6,
            Some(ParseYield::Message(MockMessage::from(3))),
        )]),
    ]);

    let source = MockByteSource::new(
        0,
        [
            Ok(Some(
                MockReloadSeed::new(5, 0).sleep_duration(SOURCE_SLEEP_DURATION),
            )),
            Ok(Some(
                MockReloadSeed::new(4, 0).sleep_duration(SOURCE_SLEEP_DURATION),
            )),
            Ok(Some(
                MockReloadSeed::new(6, 0).sleep_duration(SOURCE_SLEEP_DURATION),
            )),
            Ok(None),
            Ok(None),
        ],
    );

    let mut producer = MessageProducer::new(parser, source);

    let mut timeout_received = 0;
    let mut read_idx = 0;
    let mut collector = GeneralLogCollector::default();
    loop {
        collector.get_records().clear();
        match timeout(
            Duration::from_millis(2),
            producer.produce_next(&mut collector),
        )
        .await
        {
            Ok(res) => {
                match read_idx {
                    0 => {
                        let res = res.unwrap();
                        assert!(matches!(res, ProduceSummary::Processed { .. }));
                        let items = collector.get_records();
                        assert_eq!(items.len(), 1);
                        assert!(matches!(
                            items[0],
                            ParseYield::Message(MockMessage { content: 1 })
                        ));
                    }
                    1 => {
                        let res = res.unwrap();
                        assert!(matches!(res, ProduceSummary::Processed { .. }));
                        let items = collector.get_records();
                        assert_eq!(items.len(), 1);
                        assert!(matches!(
                            items[0],
                            ParseYield::Message(MockMessage { content: 2 })
                        ));
                    }
                    2 => {
                        let res = res.unwrap();
                        assert!(matches!(res, ProduceSummary::Processed { .. }));
                        let items = collector.get_records();
                        assert_eq!(items.len(), 1);
                        assert!(matches!(
                            items[0],
                            ParseYield::Message(MockMessage { content: 3 })
                        ));
                    }
                    3 => {
                        let res = res.unwrap();
                        assert!(matches!(res, ProduceSummary::NoBytesAvailable { .. }));
                        let items = collector.get_records();
                        assert_eq!(items.len(), 0);
                        break;
                    }
                    _invalid => panic!("Unexpected read_next_segment() results. Idx: {_invalid}"),
                };
                read_idx += 1;
            }
            Err(_elapsed) => {
                timeout_received += 1;
            }
        }
    }

    assert!(timeout_received > 50);
}
