use crate::{
    events::{NativeError, NativeErrorKind},
    operations::{OperationAPI, OperationResult},
    state::{SessionFile, SessionStateAPI},
    tail,
};
use indexer_base::progress::Severity;
use log::trace;
use parsers::{dlt, text, LogMessage, MessageStreamItem, Parser};
use sources::{
    command,
    factory::{ParserType, SourceType, Transport},
    pcap,
    producer::{MessageProducer, SdeReceiver},
    raw, socket, ByteSource,
};
use std::fs::File;
use tokio::{
    join, select,
    sync::mpsc::{channel, Receiver, Sender},
};
use tokio_stream::StreamExt;

#[allow(clippy::type_complexity)]
pub async fn handle(
    operation_api: OperationAPI,
    state: SessionStateAPI,
    source: SourceType,
    rx_sde: Option<SdeReceiver>,
) -> OperationResult<()> {
    let rx_sde = rx_sde.ok_or(NativeError {
        severity: Severity::ERROR,
        kind: NativeErrorKind::UnsupportedFileType,
        message: Some(String::from("Observe operation requires SDE channel")),
    })?;
    let result: OperationResult<()> = match source {
        SourceType::Stream(transport, parser_type) => {
            let fibex_metadata;
            match parser_type {
                ParserType::SomeIP(_) => {
                    return Err(NativeError {
                        severity: Severity::ERROR,
                        kind: NativeErrorKind::UnsupportedFileType,
                        message: Some(String::from("SomeIP parser not yet supported")),
                    });
                }
                ParserType::Text => {
                    listen_from_source(
                        transport,
                        text::StringTokenizer,
                        operation_api,
                        state,
                        rx_sde,
                    )
                    .await
                }
                ParserType::Pcap(settings) => {
                    fibex_metadata = if let Some(fibex_file_paths) = settings.dlt.fibex_file_paths {
                        dlt::gather_fibex_data(dlt::FibexConfig { fibex_file_paths })
                    } else {
                        None
                    };
                    listen_from_source(
                        transport,
                        dlt::DltParser::new(
                            settings.dlt.filter_config.map(|f| f.into()),
                            fibex_metadata.as_ref(),
                            settings.dlt.with_storage_header,
                        ),
                        operation_api,
                        state,
                        rx_sde,
                    )
                    .await
                }
                ParserType::Dlt(settings) => {
                    fibex_metadata = if let Some(paths) = settings.fibex_file_paths {
                        dlt::gather_fibex_data(dlt::FibexConfig {
                            fibex_file_paths: paths,
                        })
                    } else {
                        None
                    };
                    listen_from_source(
                        transport,
                        dlt::DltParser::new(
                            settings.filter_config.map(|f| f.into()),
                            fibex_metadata.as_ref(),
                            settings.with_storage_header,
                        ),
                        operation_api,
                        state,
                        rx_sde,
                    )
                    .await
                }
            }
        }
        SourceType::File(filename, parser_type) => {
            match parser_type {
                ParserType::SomeIP(_) => {
                    return Err(NativeError {
                        severity: Severity::ERROR,
                        kind: NativeErrorKind::FileNotFound,
                        message: Some(String::from("SomeIP parser not yet supported")),
                    });
                }
                ParserType::Text => {
                    state
                        .set_session_file(SessionFile::Existed(filename.clone()))
                        .await?;
                    let (tx_tail, mut rx_tail): (
                        Sender<Result<(), tail::Error>>,
                        Receiver<Result<(), tail::Error>>,
                    ) = channel(1);
                    // Grab main file content
                    state.update_session().await?;
                    // Confirm: main file content has been read
                    state.file_read().await?;
                    // Switching to tail
                    let cancel = operation_api.cancellation_token();
                    operation_api.started();
                    let (result, tracker) = join!(
                        async {
                            let result = select! {
                                res = async move {
                                    while let Some(update) = rx_tail.recv().await {
                                        update.map_err(|err| NativeError {
                                            severity: Severity::ERROR,
                                            kind: NativeErrorKind::Interrupted,
                                            message: Some(err.to_string()),
                                        })?;
                                        state.update_session().await?;
                                    }
                                    Ok(())
                                } => res,
                                _ = cancel.cancelled() => Ok(())
                            };
                            result
                        },
                        tail::track(&filename, tx_tail, operation_api.cancellation_token()),
                    );
                    result
                        .and_then(|_| {
                            tracker.map_err(|e| NativeError {
                                severity: Severity::ERROR,
                                kind: NativeErrorKind::Interrupted,
                                message: Some(format!("Tailing error: {}", e)),
                            })
                        })
                        .map(|_| None)
                }
                ParserType::Pcap(settings) => {
                    let fibex_metadata =
                        if let Some(fibex_file_paths) = settings.dlt.fibex_file_paths {
                            dlt::gather_fibex_data(dlt::FibexConfig { fibex_file_paths })
                        } else {
                            None
                        };
                    let dlt_parser = dlt::DltParser::new(
                        settings.dlt.filter_config.map(|f| f.into()),
                        fibex_metadata.as_ref(),
                        settings.dlt.with_storage_header,
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
                    let (_, listening) = join!(
                        tail::track(&filename, tx_tail, operation_api.cancellation_token()),
                        listen(
                            operation_api,
                            state,
                            MessageProducer::new(dlt_parser, source, Some(rx_sde)),
                            Some(rx_tail),
                        )
                    );
                    listening
                }
                ParserType::Dlt(settings) => {
                    let fibex_metadata = if let Some(fibex_file_paths) = settings.fibex_file_paths {
                        dlt::gather_fibex_data(dlt::FibexConfig { fibex_file_paths })
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
                    let (_, listening) = join!(
                        tail::track(&filename, tx_tail, operation_api.cancellation_token()),
                        listen(
                            operation_api,
                            state,
                            MessageProducer::new(dlt_parser, source, Some(rx_sde)),
                            Some(rx_tail),
                        )
                    );
                    listening
                }
            }
        }
    };
    result
}

enum Next<T: LogMessage> {
    Item(MessageStreamItem<T>),
    Waiting,
}

async fn listen_from_source<T: LogMessage, P: Parser<T>>(
    transport: Transport,
    parser: P,
    operation_api: OperationAPI,
    state: SessionStateAPI,
    rx_sde: SdeReceiver,
) -> OperationResult<()> {
    match transport {
        Transport::UDP(config) => {
            listen(
                operation_api,
                state,
                MessageProducer::new(
                    parser,
                    socket::udp::UdpSource::new(&config.bind_addr, config.multicast)
                        .await
                        .map_err(|e| NativeError {
                            severity: Severity::ERROR,
                            kind: NativeErrorKind::Interrupted,
                            message: Some(format!("Fail to create socket due error: {:?}", e)),
                        })?,
                    Some(rx_sde),
                ),
                None,
            )
            .await
        }
        Transport::TCP(_config) => {
            todo!("Transport::Process not implemented");
        }
        Transport::Process(config) => {
            listen(
                operation_api,
                state,
                MessageProducer::new(
                    parser,
                    command::process::ProcessSource::new(config.command, config.args, config.envs)
                        .await
                        .map_err(|e| NativeError {
                            severity: Severity::ERROR,
                            kind: NativeErrorKind::Interrupted,
                            message: Some(format!(
                                "Fail to create process source due error: {:?}",
                                e
                            )),
                        })?,
                    Some(rx_sde),
                ),
                None,
            )
            .await
        }
        Transport::Serial(config) => {
            listen(
                operation_api,
                state,
                MessageProducer::new(
                    parser,
                    sources::serial::serialport::SerialSource::new(&config).map_err(|e| {
                        NativeError {
                            severity: Severity::ERROR,
                            kind: NativeErrorKind::Interrupted,
                            message: Some(format!(
                                "Fail to create serial connection due error: {:?}",
                                e
                            )),
                        }
                    })?,
                    Some(rx_sde),
                ),
                None,
            )
            .await
        }
    }
}

async fn listen<T: LogMessage, P: Parser<T>, S: ByteSource>(
    operation_api: OperationAPI,
    state: SessionStateAPI,
    mut producer: MessageProducer<T, P, S>,
    mut rx_tail: Option<Receiver<Result<(), tail::Error>>>,
) -> OperationResult<()> {
    use log::debug;
    state.set_session_file(SessionFile::ToBeCreated).await?;
    let cancel = operation_api.cancellation_token();
    let stream = producer.as_stream();
    futures::pin_mut!(stream);
    let cancel_on_tail = cancel.clone();
    operation_api.started();
    while let Some(next) = select! {
        next_from_stream = async {
            if let Some((_, item)) = stream.next().await {
                Some(Next::Item(item))
            } else {
                Some(Next::Waiting)
            }
        } => next_from_stream,
        _ = cancel.cancelled() => None,
    } {
        match next {
            Next::Item(item) => {
                match item {
                    MessageStreamItem::Item(item) => {
                        state.write_session_file(format!("{}\n", item)).await?;
                    }
                    MessageStreamItem::Done => {
                        trace!("observe, message stream is done");
                        state.flush_session_file().await?;
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
            Next::Waiting => {
                if let Some(mut rx_tail) = rx_tail.take() {
                    if select! {
                        next_from_stream = rx_tail.recv() => {
                            if let Some(result) = next_from_stream {
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
    debug!("listen done");
    Ok(None)
}
