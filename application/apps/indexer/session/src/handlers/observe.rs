use crate::{
    events::{NativeError, NativeErrorKind},
    operations::{OperationAPI, OperationResult},
    state::SessionStateAPI,
    tail, writer,
};
use indexer_base::progress::Severity;
use log::debug;
use sources::{
    pcap::{file::PcapngByteSource, format::dlt::DltParser},
    producer::MessageProducer,
    ByteSource, LogMessage, MessageStreamItem, Parser,
};
use std::fs::File;
use std::path::{Path, PathBuf};
use tokio::{
    join, select,
    sync::mpsc::{
        channel, unbounded_channel, Receiver, Sender, UnboundedReceiver, UnboundedSender,
    },
};
use tokio_stream::StreamExt;
use tokio_util::sync::CancellationToken;
use uuid::Uuid;

pub enum Target<T, P, S>
where
    T: LogMessage + 'static,
    P: Parser<T> + 'static,
    S: ByteSource + 'static,
{
    TextFile(PathBuf),
    Producer(MessageProducer<T, P, S>),
}

/// observe a file initially by creating the meta for it and sending it as metadata update
/// for the content grabber (current_grabber)
/// if the metadata was successfully created, we return the line count of it
/// if the operation was stopped, we return None
pub async fn handle(
    operation_api: OperationAPI,
    state: SessionStateAPI,
    file_path: &Path,
) -> OperationResult<()> {
    let dest_path = file_path.parent();
    let target = if let Some(ext) = file_path.extension() {
        if ext.to_ascii_lowercase() == "pcapng" {
            let dlt_parser = DltParser {
                filter_config: None,
                fibex_metadata: None,
            };
            let in_file = File::open(&file_path).expect("cannot open file");
            let source = PcapngByteSource::new(in_file).expect("cannot create source");
            Target::Producer(MessageProducer::new(dlt_parser, source))
        } else {
            Target::TextFile(file_path.to_path_buf())
        }
    } else {
        Target::TextFile(file_path.to_path_buf())
    };
    let (paths, result) = match target {
        Target::TextFile(path) => {
            state.set_session_file(path.clone()).await?;
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
                tail::track(path.clone(), tx_tail_update, tail_shutdown),
            );
            (
                vec![path],
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
        Target::Producer(mut producer) => {
            let dest_path = if let Some(dest_path) = dest_path {
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
            let cancel = operation_api.get_cancellation_token_listener();
            let producer_stream = producer.as_stream();
            futures::pin_mut!(producer_stream);
            let (session_result, binary_result, flashing, producer_res) = join!(
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
                    while let (Some(_bytes_session), Some(_bytes_binary)) =
                        join!(rx_session_file_flush.recv(), rx_binary_file_flush.recv())
                    {
                        if !state.is_closing() {
                            state.update_session().await?;
                        }
                    }
                    Ok::<(), NativeError>(())
                },
                async {
                    while let Some((_, item)) = select! {
                        msg = producer_stream.next() => msg,
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
                                binary_writer
                                    .send(item.as_stored_bytes().iter())
                                    .map_err(|e| NativeError {
                                        severity: Severity::ERROR,
                                        kind: NativeErrorKind::Io,
                                        message: Some(e.to_string()),
                                    })?;
                            }
                            MessageStreamItem::Done => {
                                break;
                            }
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
                } else if let Err(err) = flashing {
                    Err(err)
                } else if let Err(err) = producer_res {
                    Err(err)
                } else {
                    Ok(None)
                },
            )
        }
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
