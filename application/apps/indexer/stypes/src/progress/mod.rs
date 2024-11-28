#[cfg(any(test, feature = "rustcore"))]
mod extending;

use crate::*;

#[derive(Debug, Serialize, Deserialize, Clone)]
#[extend::encode_decode]
pub struct Notification {
    pub severity: Severity,
    pub content: String,
    pub line: Option<usize>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(tag = "type")]
#[extend::encode_decode]
pub enum Progress {
    Ticks(Ticks),
    Notification(Notification),
    Stopped,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[extend::encode_decode]
pub struct Ticks {
    pub count: u64,
    pub state: Option<String>,
    pub total: Option<u64>,
}
