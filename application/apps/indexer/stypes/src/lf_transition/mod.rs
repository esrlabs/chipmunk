#[cfg(any(test, feature = "rustcore"))]
mod extending;
#[cfg(any(test, feature = "nodejs"))]
mod nodejs;
#[cfg(test)]
mod proptest;

use crate::*;

#[derive(Debug, Serialize, Deserialize, Clone)]
#[extend::encode_decode]
pub enum LifecycleTransition {
    Started { uuid: Uuid, alias: String },
    Ticks { uuid: Uuid, ticks: Ticks },
    Stopped(Uuid),
}
