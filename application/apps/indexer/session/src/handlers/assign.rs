use crate::{
    events::{CallbackEvent, NativeError, NativeErrorKind},
    operations::{OperationAPI, OperationResult},
    state::SessionStateAPI,
    tail, writer,
};
use indexer_base::progress::{ComputationResult, Progress, Severity};
use log::{debug, info, trace};
use processor::{
    grabber::{AsyncGrabTrait, GrabMetadata, GrabTrait, MetadataSource},
    text_source::TextFileSource,
};
use sources::{
    pcap::{file::PcapngByteSource, format::dlt::DltParser},
    producer::MessageProducer,
    ByteSource, LogMessage, MessageStreamItem, Parser,
};
use std::fs::File;
use std::path::{Path, PathBuf};
use tokio::{
    join,
    sync::mpsc::{unbounded_channel, UnboundedReceiver, UnboundedSender},
    task,
};
use tokio_stream::{Stream, StreamExt};
use tokio_util::sync::CancellationToken;
use uuid::Uuid;

type Grabber = processor::grabber::Grabber<TextFileSource>;

pub enum Target<T, P, S>
where
    T: LogMessage + 'static,
    P: Parser<T> + 'static,
    S: ByteSource + 'static,
{
    TextFile(PathBuf),
    Producer(MessageProducer<T, P, S>),
}

/// assign a file initially by creating the meta for it and sending it as metadata update
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
        if ext.to_ascii_lowercase() == "dlt" {
            let dlt_parser = DltParser {
                filter_config: None,
                fibex_metadata: None,
            };
            let in_file = File::open(&file_path).expect("cannot open file");
            let source = PcapngByteSource::new(in_file).expect("cannot create source");
            let mut pcap_msg_producer = MessageProducer::new(dlt_parser, source);
            Target::Producer(pcap_msg_producer)
        } else {
            Target::TextFile(file_path.to_path_buf())
        }
    } else {
        Target::TextFile(file_path.to_path_buf())
    };
    match target {
        Target::TextFile(path) => {
            let mut session_grabber =
                match Grabber::new(TextFileSource::new(&path, &path.to_string_lossy())) {
                    Ok(grabber) => grabber,
                    Err(err) => {
                        return Err(NativeError {
                            severity: Severity::ERROR,
                            kind: NativeErrorKind::Grabber,
                            message: Some(format!(
                                "Failed to create session file grabber. Error: {}",
                                err
                            )),
                        });
                    }
                };
            let mut rx_update = tail::Tracker::create(path, operation_api.get_cancellation_token())
                .await
                .map_err(|e| NativeError {
                    severity: Severity::ERROR,
                    kind: NativeErrorKind::Io,
                    message: Some(e.to_string()),
                })?;
            update(&mut session_grabber, &operation_api, &state).await?;
            task::spawn(async move {
                // TODO:: report about finish of loop
                while let Some(upd) = rx_update.recv().await {
                    if let Err(err) = upd {
                        return Err(NativeError {
                            severity: Severity::ERROR,
                            kind: NativeErrorKind::Interrupted,
                            message: Some(err.to_string()),
                        });
                    } else {
                        update(&mut session_grabber, &operation_api, &state).await?;
                    }
                }
                Ok(())
            });
            Ok(None)
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
                operation_api.get_cancellation_token(),
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
                operation_api.get_cancellation_token(),
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
            let mut session_grabber = match Grabber::new(TextFileSource::new(
                &session_file_path,
                &file_name.to_string(),
            )) {
                Ok(grabber) => grabber,
                Err(err) => {
                    return Err(NativeError {
                        severity: Severity::ERROR,
                        kind: NativeErrorKind::Grabber,
                        message: Some(format!(
                            "Failed to create session file grabber. Error: {}",
                            err
                        )),
                    });
                }
            };
            task::spawn(async move {
                // TODO:: report about finish of loop
                let producer_stream = producer.as_stream();
                futures::pin_mut!(producer_stream);
                let (
                    session_result,
                    binary_result,
                    session_flashing,
                    binary_flashing,
                    producer_res,
                ) = join!(
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
                        while let Some(_bytes) = rx_session_file_flush.recv().await {
                            update(&mut session_grabber, &operation_api, &state).await?;
                        }
                        Ok::<(), NativeError>(())
                    },
                    async {
                        while let Some(_bytes) = rx_binary_file_flush.recv().await {}
                        Ok::<(), NativeError>(())
                    },
                    async {
                        while let Some((_, item)) = producer_stream.next().await {
                            match item {
                                MessageStreamItem::Item(item) => {
                                    session_writer
                                        .send(format!("{}\n", item).as_bytes().iter())
                                        .map_err(|e| NativeError {
                                            severity: Severity::ERROR,
                                            kind: NativeErrorKind::Io,
                                            message: Some(e.to_string()),
                                        })?;
                                    binary_writer.send(item.as_stored_bytes().iter()).map_err(
                                        |e| NativeError {
                                            severity: Severity::ERROR,
                                            kind: NativeErrorKind::Io,
                                            message: Some(e.to_string()),
                                        },
                                    )?;
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
                if let Err(err) = session_result {
                    Err(err)
                } else if let Err(err) = binary_result {
                    Err(err)
                } else if let Err(err) = session_flashing {
                    Err(err)
                } else if let Err(err) = binary_flashing {
                    Err(err)
                } else if let Err(err) = producer_res {
                    Err(err)
                } else {
                    Ok(())
                }
            });
            Ok(None)
        }
    }
}

async fn update(
    grabber: &mut Grabber,
    operation_api: &OperationAPI,
    state: &SessionStateAPI,
) -> Result<(), NativeError> {
    let metadata = grabber.source().from_file(Some(state.get_shutdown_token()));
    match metadata {
        Ok(ComputationResult::Item(metadata)) => {
            debug!("RUST: received new stream metadata");
            let line_count = metadata.line_count as u64;
            state.set_metadata(Some(metadata)).await?;
            operation_api.emit(CallbackEvent::StreamUpdated(line_count));
        }
        Ok(ComputationResult::Stopped) => {
            debug!("RUST: stream metadata calculation aborted");
            operation_api.emit(CallbackEvent::Progress {
                uuid: operation_api.id(),
                progress: Progress::Stopped,
            });
        }
        Err(e) => {
            let err_msg = format!("RUST error computing session metadata: {:?}", e);
            operation_api.emit(CallbackEvent::SessionError(NativeError {
                severity: Severity::WARNING,
                kind: NativeErrorKind::ComputationFailed,
                message: Some(err_msg),
            }));
        }
    }
    Ok(())
}
