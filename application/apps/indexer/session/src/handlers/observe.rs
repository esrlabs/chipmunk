use crate::{
    events::{NativeError, NativeErrorKind},
    operations::{OperationAPI, OperationResult},
    state::SessionStateAPI,
    tail,
};
use indexer_base::progress::Severity;
use log::trace;
use parsers::{dlt, LogMessage, MessageStreamItem, Parser};
use sources::{
    factory::{ParserType, Source, Transport},
    pcap,
    producer::MessageProducer,
    raw, socket, ByteSource,
};
use std::{
    fs::File,
    io::{BufWriter, Write},
    path::PathBuf,
    time::Instant,
};
use tokio::{
    join, select,
    sync::mpsc::{channel, Receiver, Sender},
    time::{timeout, Duration},
};
use tokio_stream::StreamExt;
use tokio_util::sync::CancellationToken;
use uuid::Uuid;

const NOTIFY_IN_MS: u128 = 250;

#[allow(clippy::type_complexity)]
pub async fn handle(
    operation_api: OperationAPI,
    state: SessionStateAPI,
    source: Source,
) -> OperationResult<()> {
    let (paths, result): (Vec<PathBuf>, OperationResult<()>) = match source {
        Source::Stream(transport, parser_type) => {
            let (source, dest_path) = match transport {
                Transport::UDP(config) => {
                    let source = socket::udp::UdpSource::new(&config.bind_addr, config.multicast)
                        .await
                        .map_err(|e| NativeError {
                            severity: Severity::ERROR,
                            kind: NativeErrorKind::Interrupted,
                            message: Some(format!("Fail to create socket due error: {:?}", e)),
                        })?;
                    (source, config.dest_path)
                }
                Transport::TCP(_config) => {
                    todo!("Transport::Process not implemented");
                    // return Err(NativeError {
                    //     severity: Severity::ERROR,
                    //     kind: NativeErrorKind::Interrupted,
                    //     message: Some(String::from("Transport::TCP not implemented")),
                    // });
                }
                Transport::Process(_config) => {
                    todo!("Transport::Process not implemented");
                    // return Err(NativeError {
                    //     severity: Severity::ERROR,
                    //     kind: NativeErrorKind::Interrupted,
                    //     message: Some(String::from("Transport::Process not implemented")),
                    // });
                }
            };
            let fibex_metadata;
            let parser = match parser_type {
                ParserType::SomeIP(_) => {
                    return Err(NativeError {
                        severity: Severity::ERROR,
                        kind: NativeErrorKind::FileNotFound,
                        message: Some(String::from("SomeIP parser not yet supported")),
                    });
                }
                ParserType::Text => {
                    return Err(NativeError {
                        severity: Severity::ERROR,
                        kind: NativeErrorKind::FileNotFound,
                        message: Some(String::from("Text parser above stream not yet supported")),
                    });
                }
                ParserType::PcapDlt(settings) => {
                    fibex_metadata = if let Some(paths) = settings.0.fibex_file_paths {
                        dlt::gather_fibex_data(dlt::FibexConfig {
                            fibex_file_paths: paths,
                        })
                    } else {
                        None
                    };
                    dlt::DltParser::new(
                        settings.0.filter_config.map(|f| f.into()),
                        fibex_metadata.as_ref(),
                        settings.0.with_storage_header,
                    )
                }
                ParserType::Dlt(settings) => {
                    fibex_metadata = if let Some(paths) = settings.fibex_file_paths {
                        dlt::gather_fibex_data(dlt::FibexConfig {
                            fibex_file_paths: paths,
                        })
                    } else {
                        None
                    };
                    dlt::DltParser::new(
                        settings.filter_config.map(|f| f.into()),
                        fibex_metadata.as_ref(),
                        settings.with_storage_header,
                    )
                }
            };
            listen(
                dest_path,
                operation_api,
                state,
                MessageProducer::new(parser, source),
                None,
            )
            .await?
        }
        Source::File(filename, parser_type) => {
            let dest_path = if let Some(dest_path) = filename.parent() {
                dest_path.to_path_buf()
            } else {
                return Err(NativeError {
                    severity: Severity::ERROR,
                    kind: NativeErrorKind::FileNotFound,
                    message: Some(String::from("Session destination file isn't defined")),
                });
            };
            match parser_type {
                ParserType::SomeIP(_) => {
                    return Err(NativeError {
                        severity: Severity::ERROR,
                        kind: NativeErrorKind::FileNotFound,
                        message: Some(String::from("SomeIP parser not yet supported")),
                    });
                }
                ParserType::Text => {
                    state.set_session_file(filename.clone()).await?;
                    let (tx_tail, mut rx_tail): (
                        Sender<Result<(), tail::Error>>,
                        Receiver<Result<(), tail::Error>>,
                    ) = channel(1);
                    // Grab main file content
                    state.update_session().await?;
                    // Confirm: main file content has been read
                    state.file_read().await?;
                    // Switching to tail
                    let cancel = operation_api.get_cancellation_token();
                    let tail_shutdown = CancellationToken::new();
                    let tail_shutdown_caller = tail_shutdown.clone();
                    let (result, tracker) = join!(
                        async {
                            let result = select! {
                                res = async move {
                                    while let Some(upd) = rx_tail.recv().await {
                                        if let Err(err) = upd {
                                            return Err(NativeError {
                                                severity: Severity::ERROR,
                                                kind: NativeErrorKind::Interrupted,
                                                message: Some(err.to_string()),
                                            });
                                        } else {
                                            state.update_session().await?;
                                        }
                                    }
                                    Ok(())
                                } => res,
                                _ = cancel.cancelled() => Ok(())
                            };
                            tail_shutdown_caller.cancel();
                            result
                        },
                        tail::track(filename.clone(), tx_tail, tail_shutdown),
                    );
                    (
                        vec![],
                        if let Err(err) = result {
                            Err(err)
                        } else if let Err(err) = tracker.map_err(|e| NativeError {
                            severity: Severity::ERROR,
                            kind: NativeErrorKind::Interrupted,
                            message: Some(format!("Tailing error: {}", e)),
                        }) {
                            Err(err)
                        } else {
                            Ok(None)
                        },
                    )
                }
                ParserType::PcapDlt(settings) => {
                    let fibex_metadata = if let Some(paths) = settings.0.fibex_file_paths {
                        dlt::gather_fibex_data(dlt::FibexConfig {
                            fibex_file_paths: paths,
                        })
                    } else {
                        None
                    };
                    let dlt_parser = dlt::DltParser::new(
                        settings.0.filter_config.map(|f| f.into()),
                        fibex_metadata.as_ref(),
                        settings.0.with_storage_header,
                    );
                    let source =
                        pcap::file::PcapngByteSource::new(File::open(&filename).map_err(|e| {
                            NativeError {
                                severity: Severity::ERROR,
                                kind: NativeErrorKind::Io,
                                message: Some(format!(
                                    "Fail open file {}: {}",
                                    filename.to_string_lossy(),
                                    e
                                )),
                            }
                        })?)
                        .map_err(|e| NativeError {
                            severity: Severity::ERROR,
                            kind: NativeErrorKind::ComputationFailed,
                            message: Some(format!(
                                "Fail create source for {}: {}",
                                filename.to_string_lossy(),
                                e
                            )),
                        })?;
                    let (tx_tail, rx_tail): (
                        Sender<Result<(), tail::Error>>,
                        Receiver<Result<(), tail::Error>>,
                    ) = channel(1);
                    let tail_shutdown = CancellationToken::new();
                    let (_, listening) = join!(
                        tail::track(filename.clone(), tx_tail, tail_shutdown.clone()),
                        listen(
                            dest_path,
                            operation_api,
                            state,
                            MessageProducer::new(dlt_parser, source),
                            Some(rx_tail),
                        )
                    );
                    listening?
                }
                ParserType::Dlt(settings) => {
                    let fibex_metadata = if let Some(paths) = settings.fibex_file_paths {
                        dlt::gather_fibex_data(dlt::FibexConfig {
                            fibex_file_paths: paths,
                        })
                    } else {
                        None
                    };
                    let dlt_parser = dlt::DltParser::new(
                        settings.filter_config.map(|f| f.into()),
                        fibex_metadata.as_ref(),
                        settings.with_storage_header,
                    );
                    let source =
                        raw::binary::BinaryByteSource::new(File::open(&filename).map_err(|e| {
                            NativeError {
                                severity: Severity::ERROR,
                                kind: NativeErrorKind::Io,
                                message: Some(format!(
                                    "Fail open file {}: {}",
                                    filename.to_string_lossy(),
                                    e
                                )),
                            }
                        })?);
                    let (tx_tail, rx_tail): (
                        Sender<Result<(), tail::Error>>,
                        Receiver<Result<(), tail::Error>>,
                    ) = channel(1);
                    let tail_shutdown = CancellationToken::new();
                    let (_, listening) = join!(
                        tail::track(filename.clone(), tx_tail, tail_shutdown.clone()),
                        listen(
                            dest_path,
                            operation_api,
                            state,
                            MessageProducer::new(dlt_parser, source),
                            Some(rx_tail),
                        )
                    );
                    listening?
                }
            }
        }
    };
    trace!("done observing...cleaning up files: {:?}", paths);
    for path in paths {
        if path.exists() {
            std::fs::remove_file(path).map_err(|e| NativeError {
                severity: Severity::ERROR,
                kind: NativeErrorKind::Io,
                message: Some(e.to_string()),
            })?;
        }
    }
    result
}

enum Next<T: LogMessage> {
    Item(MessageStreamItem<T>),
    Notify,
    Waiting,
}

async fn listen<T: LogMessage, P: Parser<T>, S: ByteSource>(
    dest_path: PathBuf,
    operation_api: OperationAPI,
    state: SessionStateAPI,
    mut producer: MessageProducer<T, P, S>,
    mut rx_tail: Option<Receiver<Result<(), tail::Error>>>,
) -> Result<(Vec<PathBuf>, OperationResult<()>), NativeError> {
    let file_name = Uuid::new_v4();
    let session_file_path = dest_path.join(format!("{}.session", file_name));
    let binary_file_path = dest_path.join(format!("{}.bin", file_name));
    let mut session_writer = BufWriter::new(File::create(session_file_path.clone()).map_err(
        |e| NativeError {
            severity: Severity::ERROR,
            kind: NativeErrorKind::Io,
            message: Some(format!(
                "Fail to create session writer for {}: {}",
                session_file_path.to_string_lossy(),
                e
            )),
        },
    )?);
    let mut binary_writer = BufWriter::new(File::create(binary_file_path.clone()).map_err(
        |e| NativeError {
            severity: Severity::ERROR,
            kind: NativeErrorKind::Io,
            message: Some(format!(
                "Fail to create binary writer for {}: {}",
                session_file_path.to_string_lossy(),
                e
            )),
        },
    )?);
    // let (tx_event, mut rx_event): (UnboundedSender<Event>, UnboundedReceiver<Event>) =
    //     unbounded_channel();
    // TODO: producer should return relevate source_id. It should be used
    // instead an internal file alias (file_name.to_string())
    //
    // call should looks like:
    // TextFileSource::new(&session_file_path, producer.source_alias());
    // or
    // TextFileSource::new(&session_file_path, producer.source_id());
    state.set_session_file(session_file_path.clone()).await?;
    let cancel = operation_api.get_cancellation_token();
    let stream = producer.as_stream();
    futures::pin_mut!(stream);
    let mut last_message = Instant::now();
    let mut has_updated_content = false;
    let cancel_on_tail = cancel.clone();
    while let Some(next) = select! {
        msg = async {
            match timeout(Duration::from_millis(NOTIFY_IN_MS as u64), stream.next()).await {
                Ok(item) => {
                    if let Some((_, item)) = item {
                        Some(Next::Item(item))
                    } else {
                        Some(Next::Waiting)
                    }
                },
                Err(_) => Some(Next::Notify),
            }
        } => msg,
        _ = cancel.cancelled() => None,
    } {
        match next {
            Next::Item(item) => {
                match item {
                    MessageStreamItem::Item(item) => {
                        session_writer
                            .write_fmt(format_args!("{}\n", item))
                            .map_err(|e| NativeError {
                                severity: Severity::ERROR,
                                kind: NativeErrorKind::Io,
                                message: Some(e.to_string()),
                            })?;
                        item.to_writer(&mut binary_writer)
                            .map_err(|e| NativeError {
                                severity: Severity::ERROR,
                                kind: NativeErrorKind::Io,
                                message: Some(e.to_string()),
                            })?;
                        if !state.is_closing() && last_message.elapsed().as_millis() > NOTIFY_IN_MS
                        {
                            session_writer.flush().map_err(|e| NativeError {
                                severity: Severity::ERROR,
                                kind: NativeErrorKind::Io,
                                message: Some(e.to_string()),
                            })?;
                            state.update_session().await?;
                            last_message = Instant::now();
                            has_updated_content = false;
                        } else {
                            has_updated_content = true;
                        }
                    }
                    MessageStreamItem::Done => {
                        trace!("observe, message stream is done");
                        session_writer.flush().map_err(|e| NativeError {
                            severity: Severity::ERROR,
                            kind: NativeErrorKind::Io,
                            message: Some(e.to_string()),
                        })?;
                        state.update_session().await?;
                        state.file_read().await?;
                    }
                    // MessageStreamItem::FileRead => {
                    //     state.file_read().await?;
                    // }
                    MessageStreamItem::Skipped => {
                        trace!("observe: skipped a message");
                    }
                    MessageStreamItem::Incomplete => {
                        trace!("observe: incomplete message");
                    }
                    MessageStreamItem::Empty => {
                        trace!("observe: empty message");
                    }
                }
            }
            Next::Notify => {
                if !state.is_closing() && has_updated_content {
                    state.update_session().await?;
                    has_updated_content = false;
                }
            }
            Next::Waiting => {
                if let Some(mut rx_tail) = rx_tail.take() {
                    if select! {
                        msg = rx_tail.recv() => {
                            if let Some(result) = msg {
                                result.is_err()
                            } else {
                                true
                            }
                        },
                        _ = cancel_on_tail.cancelled() => true,
                    } {
                        break;
                    }
                } else {
                    break;
                }
            }
        }
    }
    Ok((vec![session_file_path, binary_file_path], Ok(None)))
}
