#[cfg(feature = "rustcore")]
mod extending;
#[cfg(feature = "nodejs")]
mod nodejs;
#[cfg(test)]
mod proptest;

use crate::*;

#[derive(Debug, Serialize, Deserialize, Clone)]
#[extend::encode_decode]
pub struct Notification {
    pub severity: Severity,
    pub content: String,
    pub line: Option<usize>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
// #[serde(tag = "type", content = "value")]
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
