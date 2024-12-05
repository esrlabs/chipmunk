#[cfg(feature = "rustcore")]
mod extending;
#[cfg(feature = "nodejs")]
mod nodejs;
#[cfg(test)]
mod proptest;

use crate::*;

#[derive(Debug, Serialize, Deserialize, Clone)]
// #[serde(tag = "type", content = "value")]
#[extend::encode_decode]
pub enum LifecycleTransition {
    Started { uuid: Uuid, alias: String },
    Ticks { uuid: Uuid, ticks: Ticks },
    Stopped(Uuid),
}
