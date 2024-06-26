use super::{u8_to_i32, ToBytes};
use event::callback_event::search_values_updated;
use event::callback_event::{self, Event};
use node_bindgen::{
    core::{val::JsEnv, NjError, TryIntoJs},
    sys::napi_value,
};
use protocol::*;
use session::progress::Severity;
use session::{
    events::{CallbackEvent, NativeError, NativeErrorKind},
    progress::Progress,
};
use std::{collections::HashMap, mem};

#[derive(Debug)]
pub struct CallbackEventWrapped(Option<CallbackEvent>);

impl CallbackEventWrapped {
    pub fn new(event: CallbackEvent) -> Self {
        Self(Some(event))
    }
}

impl TryIntoJs for CallbackEventWrapped {
    fn try_to_js(mut self, js_env: &JsEnv) -> Result<napi_value, NjError> {
        let bytes = u8_to_i32(self.into_bytes());
        let arr = js_env.create_array_with_len(bytes.len())?;
        for (i, b) in bytes.into_iter().enumerate() {
            let b = js_env.create_int32(b)?;
            js_env.set_element(arr, b, i)?;
        }
        Ok(arr)
    }
}

impl From<CallbackEvent> for CallbackEventWrapped {
    fn from(ev: CallbackEvent) -> CallbackEventWrapped {
        CallbackEventWrapped::new(ev)
    }
}

fn get_native_err(err: NativeError) -> error::NativeError {
    error::NativeError {
        severity: match err.severity {
            Severity::ERROR => error::Severity::Error.into(),
            Severity::WARNING => error::Severity::Warning.into(),
        },
        kind: match err.kind {
            NativeErrorKind::ChannelError => error::NativeErrorKind::ChannelError.into(),
            NativeErrorKind::ComputationFailed => error::NativeErrorKind::ComputationFailed.into(),
            NativeErrorKind::Configuration => error::NativeErrorKind::Configuration.into(),
            NativeErrorKind::FileNotFound => error::NativeErrorKind::FileNotFound.into(),
            NativeErrorKind::Grabber => error::NativeErrorKind::Grabber.into(),
            NativeErrorKind::Interrupted => error::NativeErrorKind::Interrupted.into(),
            NativeErrorKind::Io => error::NativeErrorKind::Io.into(),
            NativeErrorKind::NotYetImplemented => error::NativeErrorKind::NotYetImplemented.into(),
            NativeErrorKind::OperationSearch => error::NativeErrorKind::OperationSearch.into(),
            NativeErrorKind::UnsupportedFileType => {
                error::NativeErrorKind::UnsupportedFileType.into()
            }
        },
        message: err.message.unwrap_or_default(),
    }
}

impl ToBytes for CallbackEventWrapped {
    fn into_bytes(&mut self) -> Vec<u8> {
        let ev = self.0.take().expect("Callback event has to be provided");
        let msg = event::CallbackEvent {
            event: Some(match ev {
                CallbackEvent::StreamUpdated(v) => Event::StreamUpdated(v),
                CallbackEvent::FileRead => Event::FileRead(true),
                CallbackEvent::IndexedMapUpdated { len } => {
                    Event::IndexedMapUpdated(callback_event::IndexedMapUpdated { len })
                }
                CallbackEvent::OperationStarted(uuid) => Event::OperationStarted(uuid.to_string()),
                CallbackEvent::OperationProcessing(uuid) => {
                    Event::OperationProcessing(uuid.to_string())
                }
                CallbackEvent::SessionDestroyed => Event::SessionDestroyed(true),
                CallbackEvent::OperationDone(state) => Event::OperationDone(event::OperationDone {
                    uuid: state.uuid.to_string(),
                    result: state.result.unwrap_or_default(),
                }),
                CallbackEvent::Progress { uuid, progress } => {
                    Event::Progress(callback_event::Progress {
                        uuid: uuid.to_string(),
                        detail: Some(callback_event::progress::ProgressDetail {
                            detail: Some(match progress {
                                Progress::Stopped => {
                                    callback_event::progress::progress_detail::Detail::Stopped(true)
                                }
                                Progress::Notification(notification) => {
                                    callback_event::progress::progress_detail::Detail::Notification(
                                        event::Notification {
                                            severity: match notification.severity {
                                                Severity::ERROR => error::Severity::Error.into(),
                                                Severity::WARNING => {
                                                    error::Severity::Warning.into()
                                                }
                                            },
                                            content: notification.content,
                                            line: notification.line.unwrap_or_default() as u64,
                                        },
                                    )
                                }
                                Progress::Ticks(ticks) => {
                                    callback_event::progress::progress_detail::Detail::Ticks(
                                        event::Ticks {
                                            count: ticks.count,
                                            state: ticks.state.unwrap_or_default(),
                                            total: ticks.total.unwrap_or_default(),
                                        },
                                    )
                                }
                            }),
                        }),
                    })
                }
                CallbackEvent::AttachmentsUpdated {
                    len,
                    mut attachment,
                } => Event::AttachmentsUpdated(callback_event::AttachmentsUpdated {
                    len,
                    attachment: Some(attachment::AttachmentInfo {
                        uuid: attachment.uuid.to_string(),
                        filepath: attachment.filepath.to_string_lossy().to_string(),
                        name: mem::take(&mut attachment.name),
                        ext: attachment.ext.take().unwrap_or_default(),
                        size: attachment.size as u64,
                        mime: attachment.mime.take().unwrap_or_default(),
                        messages: attachment.messages.into_iter().map(|v| v as u64).collect(),
                    }),
                }),
                CallbackEvent::SearchMapUpdated(update) => {
                    Event::SearchMapUpdated(callback_event::SearchMapUpdated {
                        update: update.unwrap_or_default(),
                    })
                }
                CallbackEvent::SearchUpdated { found, stat } => {
                    Event::SearchUpdated(callback_event::SearchUpdated { found, stat })
                }
                CallbackEvent::SearchValuesUpdated(data) => {
                    let mut values: HashMap<u32, search_values_updated::ValueRange> =
                        HashMap::new();
                    if let Some(data) = data {
                        let _ = data.into_iter().map(|(k, (min, max))| {
                            values.insert(k as u32, search_values_updated::ValueRange { min, max })
                        });
                    }
                    Event::SearchValuesUpdated(callback_event::SearchValuesUpdated { values })
                }
                CallbackEvent::SessionError(err) => Event::SessionError(get_native_err(err)),
                CallbackEvent::OperationError { uuid, error } => {
                    Event::OperationError(callback_event::OperationError {
                        uuid: uuid.to_string(),
                        error: Some(get_native_err(error)),
                    })
                }
            }),
        };
        prost::Message::encode_to_vec(&msg)
    }
}
