use crate::{event, types::*, E};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Serialize, Deserialize)]
pub struct OperationDone {
    pub uuid: String,
    pub result: Option<String>,
}

impl TryFrom<event::OperationDone> for OperationDone {
    type Error = E;
    fn try_from(v: event::OperationDone) -> Result<Self, Self::Error> {
        Ok(OperationDone {
            uuid: v.uuid,
            result: if v.result.is_empty() {
                None
            } else {
                Some(v.result)
            },
        })
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub enum CallbackEvent {
    StreamUpdated(u64),
    FileRead,
    SearchUpdated {
        found: u64,
        stat: HashMap<String, u64>,
    },
    IndexedMapUpdated {
        len: u64,
    },
    SearchMapUpdated(Option<String>),
    SearchValuesUpdated(Option<HashMap<u8, (i64, i64)>>),
    AttachmentsUpdated {
        len: u64,
        attachment: AttachmentInfo,
    },
    Progress {
        uuid: String,
        progress: Progress,
    },
    SessionError(NativeError),
    OperationError {
        uuid: String,
        error: NativeError,
    },
    OperationStarted(String),
    OperationProcessing(String),
    OperationDone(OperationDone),
    SessionDestroyed,
}

impl TryFrom<event::CallbackEvent> for CallbackEvent {
    type Error = E;
    fn try_from(ev: event::CallbackEvent) -> Result<Self, Self::Error> {
        use event::callback_event::Event;

        let event = ev.event.ok_or(E::MissedField(String::from("event")))?;
        Ok(match event {
            Event::AttachmentsUpdated(v) => CallbackEvent::AttachmentsUpdated {
                len: v.len,
                attachment: AttachmentInfo::try_from(
                    v.attachment
                        .ok_or(E::MissedField(String::from("attachment")))?,
                )?,
            },
            Event::FileRead(_) => CallbackEvent::FileRead,
            Event::Progress(p) => CallbackEvent::Progress {
                uuid: p.uuid.clone(),
                progress: p.try_into()?,
            },
            Event::OperationDone(v) => CallbackEvent::OperationDone(v.try_into()?),
            Event::OperationProcessing(v) => CallbackEvent::OperationProcessing(v),
            Event::OperationStarted(v) => CallbackEvent::OperationStarted(v),
            Event::SessionDestroyed(_) => CallbackEvent::SessionDestroyed,
            Event::IndexedMapUpdated(v) => CallbackEvent::IndexedMapUpdated { len: v.len },
            Event::SearchMapUpdated(v) => CallbackEvent::SearchMapUpdated(if v.update.is_empty() {
                None
            } else {
                Some(v.update)
            }),
            Event::SearchUpdated(v) => CallbackEvent::SearchUpdated {
                found: v.found,
                stat: v.stat,
            },
            Event::StreamUpdated(v) => CallbackEvent::StreamUpdated(v),
            Event::SearchValuesUpdated(v) => {
                CallbackEvent::SearchValuesUpdated(if v.values.is_empty() {
                    None
                } else {
                    let values = v
                        .values
                        .into_iter()
                        .map(|(k, v)| (k as u8, (v.min as i64, v.max as i64)))
                        .collect::<HashMap<u8, (i64, i64)>>();
                    Some(values)
                })
            }
            Event::SessionError(v) => CallbackEvent::SessionError(v.try_into()?),
            Event::OperationError(v) => CallbackEvent::OperationError {
                uuid: v.uuid,
                error: v
                    .error
                    .ok_or(E::MissedField(String::from("error")))?
                    .try_into()?,
            },
        })
    }
}
