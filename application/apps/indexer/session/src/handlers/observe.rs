use crate::{
    events::{NativeError, NativeErrorKind},
    operations::{OperationAPI, OperationResult},
    state::SessionStateAPI,
    tail, writer,
};
use indexer_base::progress::Severity;
use parsers::{dlt, LogMessage, MessageStreamItem, Parser};
use sources::{
    factory::{ParserType, Source},
    pcap::file::PcapngByteSource,
    producer::MessageProducer,
    ByteSource,
};
use std::fs::File;
use std::path::PathBuf;
use tokio::{
    join, select,
    sync::mpsc::{
        channel, unbounded_channel, Receiver, Sender, UnboundedReceiver, UnboundedSender,
    },
};
use tokio_stream::{Stream, StreamExt};
use tokio_util::sync::CancellationToken;
use uuid::Uuid;

// #[derive(Debug)]
// pub enum Target<T, P, S>
// where
//     T: LogMessage + 'static,
//     P: Parser<T> + 'static,
//     S: ByteSource + 'static,
// {
//     TextFile(PathBuf),
//     Producer(MessageProducer<T, P, S>),
//     Unsupported,
// }
/// observe a file initially by creating the meta for it and sending it as metadata update
/// for the content grabber (current_grabber)
/// if the metadata was successfully created, we return the line count of it
/// if the operation was stopped, we return None
///

pub enum Producer<'a> {
    PcapFile(
        MessageProducer<
            dlt::FormattableMessage<'a>,
            dlt::DltParser<'a>,
            PcapngByteSource<std::fs::File>,
        >,
    ),
}
pub fn factory<'a, T: LogMessage, P: Parser<T>, D: ByteSource>(
    source: Source,
) -> Result<Option<Producer<'a>>, NativeError> {
    match source {
        Source::File(filename, parser_type) => match parser_type {
            ParserType::Text => Ok(None),
            _ => match parser_type {
                ParserType::Pcap => {
                    let dlt_parser = dlt::DltParser {
                        filter_config: None,
                        fibex_metadata: None,
                        with_storage_header: true,
                    };
                    let in_file = File::open(&filename).expect("cannot open file");
                    let source = PcapngByteSource::new(in_file).expect("cannot create source");
                    Ok(Some(Producer::PcapFile(MessageProducer::new(
                        dlt_parser, source,
                    ))))
                }
                _ => Err(NativeError {
                    severity: Severity::ERROR,
                    kind: NativeErrorKind::FileNotFound,
                    message: Some(String::from("Not supported type of file")),
                }),
            },
        },
        Source::Stream(transport, parser_type) => Ok(None),
    }
}

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
            _ => {
                let mut producer = match parser_type {
                    // ParserType::Pcap(_settings) => {
                    ParserType::Pcap => {
                        let dlt_parser = dlt::DltParser {
                            filter_config: None,
                            fibex_metadata: None,
                            with_storage_header: false,
                        };
                        let in_file = File::open(&filename).expect("cannot open file");
                        let source = PcapngByteSource::new(in_file).expect("cannot create source");
                        MessageProducer::new(dlt_parser, source)
                    }
                    _ => {
                        return Err(NativeError {
                            severity: Severity::ERROR,
                            kind: NativeErrorKind::FileNotFound,
                            message: Some(String::from("Not supported type of file")),
                        });
                    }
                };
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
                let (tx_session_file_flush, mut rx_session_file_flush): (
                    UnboundedSender<usize>,
                    UnboundedReceiver<usize>,
                ) = unbounded_channel();
                let (tx_binary_file_flush, mut rx_binary_file_flush): (
                    UnboundedSender<usize>,
                    UnboundedReceiver<usize>,
                ) = unbounded_channel();
                let (session_writer, rx_session_done) = writer::Writer::new(
                    &session_file_path,
                    tx_session_file_flush,
                    operation_api.get_cancellation_token_listener(),
                )
                .await
                .map_err(|e| NativeError {
                    severity: Severity::ERROR,
                    kind: NativeErrorKind::Io,
                    message: Some(e.to_string()),
                })?;
                let (binary_writer, rx_binary_done) = writer::Writer::new(
                    &binary_file_path,
                    tx_binary_file_flush,
                    operation_api.get_cancellation_token_listener(),
                )
                .await
                .map_err(|e| NativeError {
                    severity: Severity::ERROR,
                    kind: NativeErrorKind::Io,
                    message: Some(e.to_string()),
                })?;
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
                let (session_result, binary_result, flushing, producer_res) = join!(
                    async {
                        match rx_session_done.await {
                            Ok(res) => res,
                            Err(_) => Err(writer::Error::Channel(String::from(
                                "Fail to get done signal from session writer",
                            ))),
                        }
                        .map_err(|e| NativeError {
                            severity: Severity::ERROR,
                            kind: NativeErrorKind::Io,
                            message: Some(e.to_string()),
                        })
                    },
                    async {
                        match rx_binary_done.await {
                            Ok(res) => res,
                            Err(_) => Err(writer::Error::Channel(String::from(
                                "Fail to get done signal from binary writer",
                            ))),
                        }
                        .map_err(|e| NativeError {
                            severity: Severity::ERROR,
                            kind: NativeErrorKind::Io,
                            message: Some(e.to_string()),
                        })
                    },
                    async {
                        while let Some((Some(_bytes_session), Some(_bytes_binary))) = select! {
                            event = async { join!(rx_session_file_flush.recv(), rx_binary_file_flush.recv()) } => Some(event),
                            _ = cancel.cancelled() => None,
                        } {
                            if !state.is_closing() {
                                state.update_session().await?;
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
                                        .send(format!("{}\n", item_str).as_bytes().iter())
                                        .map_err(|e| NativeError {
                                            severity: Severity::ERROR,
                                            kind: NativeErrorKind::Io,
                                            message: Some(e.to_string()),
                                        })?;
                                    binary_writer.send(item.as_bytes().iter()).map_err(|e| {
                                        NativeError {
                                            severity: Severity::ERROR,
                                            kind: NativeErrorKind::Io,
                                            message: Some(e.to_string()),
                                        }
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
                (
                    vec![session_file_path, binary_file_path],
                    if let Err(err) = session_result {
                        Err(err)
                    } else if let Err(err) = binary_result {
                        Err(err)
                    } else if let Err(err) = flushing {
                        Err(err)
                    } else if let Err(err) = producer_res {
                        Err(err)
                    } else {
                        Ok(None)
                    },
                )
            }
        },
        Source::Stream(transport, parser_type) => (vec![], Ok(None)),
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
