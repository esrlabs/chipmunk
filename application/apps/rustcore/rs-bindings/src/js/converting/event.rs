use super::errors::get_native_err;
use event::callback_event;
use event::callback_event::search_values_updated;
use node_bindgen::{
    core::{safebuffer::SafeArrayBuffer, val::JsEnv, NjError, TryIntoJs},
    sys::napi_value,
};
use proto::*;
use session::{
    events::{CallbackEvent, CallbackEventId, NativeError, NativeErrorKind, OperationDone},
    progress::{Notification, Progress, Ticks},
};
use session::{progress::Severity, state::AttachmentInfo};
use std::{collections::HashMap, mem, path::PathBuf};
use uuid::Uuid;

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

pub fn test_cases() -> Vec<CallbackEventWrapped> {
    let events: Vec<CallbackEvent> = CallbackEventId::as_vec()
        .into_iter()
        .flat_map(|id| match id {
            CallbackEventId::FileRead => vec![CallbackEvent::FileRead],
            CallbackEventId::AttachmentsUpdated => vec![CallbackEvent::AttachmentsUpdated {
                len: 9,
                attachment: AttachmentInfo {
                    uuid: Uuid::new_v4(),
                    filepath: PathBuf::from("fake/path"),
                    name: String::from("test"),
                    ext: Some(String::from("test")),
                    size: 999,
                    mime: Some(String::from("media")),
                    messages: vec![1, 2, 3, 100, 101, 102],
                },
            }],
            CallbackEventId::IndexedMapUpdated => {
                vec![CallbackEvent::IndexedMapUpdated { len: 999 }]
            }
            CallbackEventId::OperationDone => vec![CallbackEvent::OperationDone(OperationDone {
                uuid: Uuid::new_v4(),
                result: Some(String::from("test")),
            })],
            CallbackEventId::OperationError => vec![CallbackEvent::OperationError {
                uuid: Uuid::new_v4(),
                error: NativeError {
                    severity: Severity::ERROR,
                    kind: NativeErrorKind::ChannelError,
                    message: Some(String::from("test")),
                },
            }],
            CallbackEventId::OperationProcessing => {
                vec![CallbackEvent::OperationProcessing(Uuid::new_v4())]
            }
            CallbackEventId::OperationStarted => {
                vec![CallbackEvent::OperationStarted(Uuid::new_v4())]
            }
            CallbackEventId::Progress => vec![
                CallbackEvent::Progress {
                    uuid: Uuid::new_v4(),
                    progress: Progress::Ticks(Ticks {
                        count: 1,
                        state: Some(String::from("test")),
                        total: Some(100),
                    }),
                },
                CallbackEvent::Progress {
                    uuid: Uuid::new_v4(),
                    progress: Progress::Notification(Notification {
                        severity: Severity::ERROR,
                        content: String::from("test"),
                        line: Some(999),
                    }),
                },
                CallbackEvent::Progress {
                    uuid: Uuid::new_v4(),
                    progress: Progress::Stopped,
                },
            ],
            CallbackEventId::SearchMapUpdated => {
                vec![CallbackEvent::SearchMapUpdated(Some(String::from("test")))]
            }
            CallbackEventId::SearchUpdated => {
                let mut stat = HashMap::new();
                stat.insert(String::from("a"), 999);
                stat.insert(String::from("b"), 999);
                stat.insert(String::from("c"), 999);
                vec![CallbackEvent::SearchUpdated {
                    found: 999 * 3,
                    stat,
                }]
            }
            CallbackEventId::SearchValuesUpdated => {
                let mut data = HashMap::new();
                data.insert(1, (1.2, 10.2));
                data.insert(2, (2.2, 20.2));
                data.insert(3, (3.2, 30.2));
                vec![CallbackEvent::SearchValuesUpdated(Some(data))]
            }
            CallbackEventId::SessionDestroyed => vec![CallbackEvent::SessionDestroyed],
            CallbackEventId::SessionError => vec![CallbackEvent::SessionError(NativeError {
                severity: Severity::ERROR,
                kind: NativeErrorKind::ChannelError,
                message: Some(String::from("test")),
            })],
            CallbackEventId::StreamUpdated => vec![CallbackEvent::StreamUpdated(999)],
        })
        .collect();
    events.into_iter().map(|ev| ev.into()).collect()
}
