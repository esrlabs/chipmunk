use crate::{
    events::{NativeError, NativeErrorKind},
    operations::{OperationAPI, OperationResult},
    state::SessionStateAPI,
    tail,
};
use indexer_base::progress::Severity;
use parsers::{dlt, LogMessage, MessageStreamItem, Parser};
use sources::{
    factory::{ParserType, Source},
    pcap,
    producer::MessageProducer,
    ByteSource,
};
use std::{
    fs::File,
    io::{BufWriter, Write},
    path::PathBuf,
    time::SystemTime,
};
use tokio::{
    join, select,
    sync::mpsc::{
        channel, unbounded_channel, Receiver, Sender, UnboundedReceiver, UnboundedSender,
    },
    time::{timeout, Duration},
};
use tokio_stream::StreamExt;
use tokio_util::sync::CancellationToken;
use uuid::Uuid;

const NOTIFY_IN_MS: u128 = 500;

#[allow(clippy::type_complexity)]
pub async fn handle(
    operation_api: OperationAPI,
    state: SessionStateAPI,
    source: Source,
) -> OperationResult<()> {
    let (paths, result): (Vec<PathBuf>, OperationResult<()>) = match source {
        Source::File(filename, parser_type) => match parser_type {
            ParserType::Text => {
                state.set_session_file(filename.clone()).await?;
                let (tx_tail_update, mut rx_tail_update): (
                    Sender<Result<(), tail::Error>>,
                    Receiver<Result<(), tail::Error>>,
                ) = channel(1);
                state.update_session().await?;
                let cancel = operation_api.get_cancellation_token_listener();
                let tail_shutdown = CancellationToken::new();
                let tail_shutdown_caller = tail_shutdown.clone();
                let (result, tracker) = join!(
                    async {
                        let result = select! {
                            res = async move {
                                while let Some(upd) = rx_tail_update.recv().await {
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
                    tail::track(filename.clone(), tx_tail_update, tail_shutdown),
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
            _ => match parser_type {
                ParserType::Pcap(settings) => {
                    let fibex_metadata = if let Some(paths) = settings.dlt.fibex_file_paths {
                        dlt::gather_fibex_data(dlt::FibexConfig {
                            fibex_file_paths: paths,
                        })
                    } else {
                        None
                    };
                    let dlt_parser = dlt::DltParser {
                        filter_config: settings
                            .dlt
                            .filter_config
                            .map(|settings| dlt::process_filter_config(settings)),
                        fibex_metadata: fibex_metadata.as_ref(),
                        with_storage_header: settings.dlt.with_storage_header,
                    };
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
                    listen(
                        filename,
                        operation_api,
                        state,
                        MessageProducer::new(dlt_parser, source),
                    )
                    .await?
                }
                _ => {
                    return Err(NativeError {
                        severity: Severity::ERROR,
                        kind: NativeErrorKind::FileNotFound,
                        message: Some(String::from("Not supported type of file")),
                    });
                }
            },
        },
        Source::Stream(_transport, _parser_type) => (vec![], Ok(None)),
    };
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

enum Event {
    Check,
    Notify,
}

async fn listen<T: LogMessage, P: Parser<T>, S: ByteSource>(
    filename: PathBuf,
    operation_api: OperationAPI,
    state: SessionStateAPI,
    mut producer: MessageProducer<T, P, S>,
) -> Result<(Vec<PathBuf>, OperationResult<()>), NativeError> {
    let dest_path = if let Some(dest_path) = filename.parent() {
        dest_path
    } else {
        return Err(NativeError {
            severity: Severity::ERROR,
            kind: NativeErrorKind::FileNotFound,
            message: Some(String::from("Session destination file isn't defined")),
        });
    };
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
    let (tx_event, mut rx_event): (UnboundedSender<Event>, UnboundedReceiver<Event>) =
        unbounded_channel();
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
    let mut last_update = SystemTime::now();
    let (notifications, producing) = join!(
        async {
            while let Some(task) = select! {
                task = async {
                    match timeout(Duration::from_millis(NOTIFY_IN_MS as u64), rx_event.recv()).await {
                        Ok(task) => task,
                        Err(_) => Some(Event::Notify),
                    }
                } => task,
                _ = cancel.cancelled() => None,
            } {
                match task {
                    Event::Check => match last_update.elapsed() {
                        Ok(elapsed) => {
                            if elapsed.as_millis() < NOTIFY_IN_MS {
                                tx_event.send(Event::Notify).map_err(|_| NativeError {
                                    severity: Severity::ERROR,
                                    kind: NativeErrorKind::ChannelError,
                                    message: Some(String::from("Fail to update session state")),
                                })?;
                            }
                        }
                        Err(err) => {
                            return Err(NativeError {
                                severity: Severity::ERROR,
                                kind: NativeErrorKind::ChannelError,
                                message: Some(format!("Fail to update session state: {}", err)),
                            });
                        }
                    },
                    Event::Notify => {
                        if !state.is_closing() {
                            state.update_session().await?;
                        }
                        last_update = SystemTime::now();
                    }
                }
            }
            Ok::<(), NativeError>(())
        },
        async {
            while let Some((_, item)) = select! {
                msg = stream.next() => msg,
                _ = cancel.cancelled() => None,
            } {
                match item {
                    MessageStreamItem::Item(item) => {
                        let item_str = format!("{}", item)
                            .replace('\u{0004}', "<#C#>")
                            .replace('\u{0005}', "<#A#>")
                            .to_owned();
                        session_writer
                            .write(format!("{}\n", item_str).as_bytes())
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
                        tx_event.send(Event::Check).map_err(|_| NativeError {
                            severity: Severity::ERROR,
                            kind: NativeErrorKind::ChannelError,
                            message: Some(String::from("Fail to trigger update session state")),
                        })?;
                    }
                    MessageStreamItem::Done => {
                        cancel.cancel();
                        break;
                    }
                    MessageStreamItem::Skipped => {}
                    MessageStreamItem::Incomplete => {}
                    _ => {}
                }
            }
            Ok::<(), NativeError>(())
        }
    );
    Ok((
        vec![session_file_path, binary_file_path],
        if let Err(err) = notifications {
            Err(err)
        } else if let Err(err) = producing {
            Err(err)
        } else {
            Ok(None)
        },
    ))
}
