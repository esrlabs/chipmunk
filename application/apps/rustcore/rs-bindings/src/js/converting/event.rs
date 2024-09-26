use super::errors::get_native_err;
use event::callback_event;
use event::callback_event::search_values_updated;
use node_bindgen::{
    core::{safebuffer::SafeArrayBuffer, val::JsEnv, NjError, TryIntoJs},
    sys::napi_value,
};
use proto::*;
use session::progress::Severity;
use session::{events::CallbackEvent, progress::Progress};
use std::{collections::HashMap, mem};

#[derive(Debug)]
pub struct CallbackEventWrapped(Option<CallbackEvent>);

impl CallbackEventWrapped {
    pub fn new(event: CallbackEvent) -> Self {
        Self(Some(event))
    }
}

impl TryIntoJs for CallbackEventWrapped {
    fn try_to_js(self, js_env: &JsEnv) -> Result<napi_value, NjError> {
        SafeArrayBuffer::new(self.into()).try_to_js(js_env)
    }
}

impl From<CallbackEvent> for CallbackEventWrapped {
    fn from(ev: CallbackEvent) -> CallbackEventWrapped {
        CallbackEventWrapped::new(ev)
    }
}

impl From<CallbackEventWrapped> for Vec<u8> {
    fn from(mut val: CallbackEventWrapped) -> Self {
        let ev = val.0.take().expect("Callback event has to be provided");
        let msg = event::CallbackEvent {
            event_oneof: Some(match ev {
                CallbackEvent::StreamUpdated(v) => callback_event::EventOneof::StreamUpdated(v),
                CallbackEvent::FileRead => callback_event::EventOneof::FileRead(true),
                CallbackEvent::IndexedMapUpdated { len } => {
                    callback_event::EventOneof::IndexedMapUpdated(
                        callback_event::IndexedMapUpdated { len },
                    )
                }
                CallbackEvent::OperationStarted(uuid) => {
                    callback_event::EventOneof::OperationStarted(uuid.to_string())
                }
                CallbackEvent::OperationProcessing(uuid) => {
                    callback_event::EventOneof::OperationProcessing(uuid.to_string())
                }
                CallbackEvent::SessionDestroyed => {
                    callback_event::EventOneof::SessionDestroyed(true)
                }
                CallbackEvent::OperationDone(state) => {
                    callback_event::EventOneof::OperationDone(event::OperationDone {
                        uuid: state.uuid.to_string(),
                        result: state.result.unwrap_or_default(),
                    })
                }
                CallbackEvent::Progress { uuid, progress } => {
                    callback_event::EventOneof::Progress(callback_event::Progress {
                        uuid: uuid.to_string(),
                        detail: Some(callback_event::progress::ProgressDetail {
                            detail_oneof: Some(match progress {
                                Progress::Stopped => {
                                    callback_event::progress::progress_detail::DetailOneof::Stopped(true)
                                }
                                Progress::Notification(notification) => {
                                    callback_event::progress::progress_detail::DetailOneof::Notification(
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
                                    callback_event::progress::progress_detail::DetailOneof::Ticks(
                                        progress::Ticks {
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
                } => callback_event::EventOneof::AttachmentsUpdated(
                    callback_event::AttachmentsUpdated {
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
                    },
                ),
                CallbackEvent::SearchMapUpdated(update) => {
                    callback_event::EventOneof::SearchMapUpdated(callback_event::SearchMapUpdated {
                        update: update.unwrap_or_default(),
                    })
                }
                CallbackEvent::SearchUpdated { found, stat } => {
                    callback_event::EventOneof::SearchUpdated(callback_event::SearchUpdated {
                        found,
                        stat,
                    })
                }
                CallbackEvent::SearchValuesUpdated(data) => {
                    let mut values: HashMap<u32, search_values_updated::ValueRange> =
                        HashMap::new();
                    if let Some(data) = data {
                        data.into_iter().for_each(|(k, (min, max))| {
                            values.insert(k as u32, search_values_updated::ValueRange { min, max });
                        });
                    }
                    callback_event::EventOneof::SearchValuesUpdated(
                        callback_event::SearchValuesUpdated { values },
                    )
                }
                CallbackEvent::SessionError(err) => {
                    callback_event::EventOneof::SessionError(get_native_err(err))
                }
                CallbackEvent::OperationError { uuid, error } => {
                    callback_event::EventOneof::OperationError(callback_event::OperationError {
                        uuid: uuid.to_string(),
                        error: Some(get_native_err(error)),
                    })
                }
            }),
        };
        prost::Message::encode_to_vec(&msg)
    }
}
