use buf_redux::{policy::MinBuffered, BufReader as ReduxReader};
use dlt_core::{
    dlt::LogLevel,
    parse::{dlt_consume_msg, DltParseError},
    statistics::{
        dlt_statistic_row_info, IdMap, LevelDistribution, StatisticInfo, StatisticRowInfo,
    },
};
use futures::stream::StreamExt;
use parsers::dlt::DltRangeParser;
use rustc_hash::FxHashMap;
use sources::producer::MessageProducer;
use std::{
    fs,
    io::{BufRead, BufReader, Read},
    path::Path,
};

pub(crate) const BIN_READER_CAPACITY: usize = 10 * 1024 * 1024;
pub(crate) const BIN_MIN_BUFFER_SPACE: usize = 10 * 1024;

pub fn count_dlt_messages_old(input: &Path) -> Result<u64, DltParseError> {
    if input.exists() {
        let f = fs::File::open(&input)?;

        let mut reader = ReduxReader::with_capacity(BIN_READER_CAPACITY, f)
            .set_policy(MinBuffered(BIN_MIN_BUFFER_SPACE));

        let mut msg_cnt: u64 = 0;
        loop {
            match reader.fill_buf() {
                Ok(content) => {
                    if content.is_empty() {
                        break;
                    }
                    if let Ok((_rest, Some(consumed))) = dlt_consume_msg(content) {
                        reader.consume(consumed as usize);
                        msg_cnt += 1;
                    } else {
                        break;
                    }
                }
                Err(e) => {
                    trace!("no more content");
                    return Err(DltParseError::Unrecoverable(format!(
                        "error for filling buffer with dlt messages: {:?}",
                        e
                    )));
                }
            }
        }
        Ok(msg_cnt)
    } else {
        Err(DltParseError::Unrecoverable(format!(
            "Couldn't find dlt file: {:?}",
            input
        )))
    }
}
/// count how many recognizable DLT messages are stored in a file
/// each message needs to be equiped with a storage header
pub async fn count_dlt_messages(input: &Path) -> Result<u64, DltParseError> {
    if input.exists() {
        use sources::raw::binary::BinaryByteSource;
        let second_reader = BufReader::new(fs::File::open(&input)?);
        let dlt_parser = DltRangeParser::new(true);

        let source = BinaryByteSource::new(second_reader);

        let mut dlt_msg_producer = MessageProducer::new(dlt_parser, source);
        let msg_stream = dlt_msg_producer.as_stream();
        Ok(msg_stream.count().await as u64)
    } else {
        Err(DltParseError::Unrecoverable(format!(
            "Couldn't find dlt file: {:?}",
            input
        )))
    }
}

pub fn get_dlt_file_info(in_file: &Path) -> Result<StatisticInfo, DltParseError> {
    let f = fs::File::open(in_file)?;

    let mut reader = ReduxReader::with_capacity(BIN_READER_CAPACITY, f)
        .set_policy(MinBuffered(BIN_MIN_BUFFER_SPACE));

    let mut app_ids: IdMap = FxHashMap::default();
    let mut context_ids: IdMap = FxHashMap::default();
    let mut ecu_ids: IdMap = FxHashMap::default();
    let mut contained_non_verbose = false;
    loop {
        match read_one_dlt_message_info(&mut reader, true) {
            Ok(Some((
                consumed,
                StatisticRowInfo {
                    app_id_context_id: Some((app_id, context_id)),
                    ecu_id: ecu,
                    level,
                    verbose,
                },
            ))) => {
                contained_non_verbose = contained_non_verbose || !verbose;
                reader.consume(consumed as usize);
                add_for_level(level, &mut app_ids, app_id);
                add_for_level(level, &mut context_ids, context_id);
                match ecu {
                    Some(id) => add_for_level(level, &mut ecu_ids, id),
                    None => add_for_level(level, &mut ecu_ids, "NONE".to_string()),
                };
            }
            Ok(Some((
                consumed,
                StatisticRowInfo {
                    app_id_context_id: None,
                    ecu_id: ecu,
                    level,
                    verbose,
                },
            ))) => {
                contained_non_verbose = contained_non_verbose || !verbose;
                reader.consume(consumed as usize);
                add_for_level(level, &mut app_ids, "NONE".to_string());
                add_for_level(level, &mut context_ids, "NONE".to_string());
                match ecu {
                    Some(id) => add_for_level(level, &mut ecu_ids, id),
                    None => add_for_level(level, &mut ecu_ids, "NONE".to_string()),
                };
            }
            Ok(None) => {
                break;
            }
            Err(e) => {
                // we couldn't parse the message. try to skip it and find the next.
                debug!("stats...try to skip and continue parsing: {}", e);
                match e {
                    DltParseError::ParsingHickup(reason) => {
                        // we couldn't parse the message. try to skip it and find the next.
                        reader.consume(4); // at least skip the magic DLT pattern
                        debug!(
                            "error parsing 1 dlt message, try to continue parsing: {}",
                            reason
                        );
                    }
                    _ => return Err(e),
                }
            }
        }
    }
    let res = StatisticInfo {
        app_ids: app_ids
            .into_iter()
            .collect::<Vec<(String, LevelDistribution)>>(),
        context_ids: context_ids
            .into_iter()
            .collect::<Vec<(String, LevelDistribution)>>(),
        ecu_ids: ecu_ids
            .into_iter()
            .collect::<Vec<(String, LevelDistribution)>>(),
        contained_non_verbose,
    };

    // TODO report progress
    // let _ = update_channel.send(Ok(IndexingProgress::GotItem { item: res }));
    // let _ = update_channel.send(Ok(IndexingProgress::Finished));
    Ok(res)
}

fn read_one_dlt_message_info<T: Read>(
    reader: &mut ReduxReader<T, MinBuffered>,
    with_storage_header: bool,
) -> Result<Option<(u64, StatisticRowInfo)>, DltParseError> {
    match reader.fill_buf() {
        Ok(content) => {
            if content.is_empty() {
                return Ok(None);
            }
            let available = content.len();
            let r = dlt_statistic_row_info(content, with_storage_header)?;
            let consumed = available - r.0.len();
            Ok(Some((consumed as u64, r.1)))
        }
        Err(e) => Err(DltParseError::ParsingHickup(format!(
            "error while parsing dlt messages: {}",
            e
        ))),
    }
}

fn add_for_level(level: Option<LogLevel>, ids: &mut IdMap, id: String) {
    if let Some(n) = ids.get_mut(&id) {
        match level {
            Some(LogLevel::Fatal) => {
                *n = LevelDistribution {
                    log_fatal: n.log_fatal + 1,
                    ..*n
                }
            }
            Some(LogLevel::Error) => {
                *n = LevelDistribution {
                    log_error: n.log_error + 1,
                    ..*n
                }
            }
            Some(LogLevel::Warn) => {
                *n = LevelDistribution {
                    log_warning: n.log_warning + 1,
                    ..*n
                }
            }
            Some(LogLevel::Info) => {
                *n = LevelDistribution {
                    log_info: n.log_info + 1,
                    ..*n
                }
            }
            Some(LogLevel::Debug) => {
                *n = LevelDistribution {
                    log_debug: n.log_debug + 1,
                    ..*n
                };
            }
            Some(LogLevel::Verbose) => {
                *n = LevelDistribution {
                    log_verbose: n.log_verbose + 1,
                    ..*n
                };
            }
            Some(LogLevel::Invalid(_)) => {
                *n = LevelDistribution {
                    log_invalid: n.log_invalid + 1,
                    ..*n
                };
            }
            None => {
                *n = LevelDistribution {
                    non_log: n.non_log + 1,
                    ..*n
                };
            }
        }
    } else {
        ids.insert(id, LevelDistribution::new(level));
    }
}
