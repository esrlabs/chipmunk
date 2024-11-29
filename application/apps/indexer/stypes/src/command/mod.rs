#[cfg(any(test, feature = "rustcore"))]
mod extending;
#[cfg(any(test, feature = "nodejs"))]
mod nodejs;
#[cfg(test)]
mod proptest;

mod folders;
mod serial;

pub use folders::*;
pub use serial::*;

use crate::*;

#[derive(Clone, Serialize, Deserialize, Debug)]
#[serde(bound(deserialize = "T: DeserializeOwned"))]
#[extend::encode_decode]
pub enum CommandOutcome<T: Serialize + DeserializeOwned> {
    Finished(T),
    Cancelled,
}

#[derive(Clone, Serialize, Deserialize, Debug)]
pub enum UuidCommandOutcome<T: Serialize> {
    Finished((Uuid, T)),
    Cancelled(Uuid),
}
