use super::errors::get_native_err;
use event::callback_event::search_values_updated;
use event::callback_event::{self, Event};
use node_bindgen::{
    core::{val::JsEnv, NjError, TryIntoJs},
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
        let bytes: Vec<u8> = self.into();
        bytes.try_to_js(js_env)
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
                        data.into_iter().for_each(|(k, (min, max))| {
                            values.insert(k as u32, search_values_updated::ValueRange { min, max });
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
