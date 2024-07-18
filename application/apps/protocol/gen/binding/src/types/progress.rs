use crate::types;
use crate::*;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub enum Progress {
    Ticks(Ticks),
    Notification(Notification),
    Stopped,
}

impl TryFrom<event::callback_event::Progress> for Progress {
    type Error = E;
    fn try_from(value: event::callback_event::Progress) -> Result<Self, Self::Error> {
        use event::callback_event::progress::progress_detail::Detail;

        let prog = value
            .detail
            .ok_or(E::MissedField(String::from("detail")))?
            .detail
            .ok_or(E::MissedField(String::from("detail")))?;
        Ok(match prog {
            Detail::Ticks(v) => Progress::Ticks(v.try_into()?),
            Detail::Notification(v) => Progress::Notification(v.try_into()?),
            Detail::Stopped(_v) => Progress::Stopped,
        })
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Notification {
    pub severity: types::Severity,
    pub content: String,
    pub line: Option<usize>,
}

impl TryFrom<event::Notification> for Notification {
    type Error = E;
    fn try_from(v: event::Notification) -> Result<Self, Self::Error> {
        Ok(Notification {
            severity: v.severity.try_into()?,
            content: v.content,
            line: Some(v.line as usize),
        })
    }
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct Ticks {
    pub count: u64,
    pub state: Option<String>,
    pub total: Option<u64>,
}

impl TryFrom<event::Ticks> for Ticks {
    type Error = E;
    fn try_from(v: event::Ticks) -> Result<Self, Self::Error> {
        Ok(Ticks {
            count: v.count,
            state: if v.state.is_empty() {
                None
            } else {
                Some(v.state)
            },
            total: Some(v.total),
        })
    }
}
