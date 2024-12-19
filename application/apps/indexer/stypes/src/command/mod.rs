#[cfg(feature = "rustcore")]
mod extending;
#[cfg(feature = "nodejs")]
mod nodejs;
#[cfg(test)]
mod proptest;
#[cfg(test)]
mod ts;

mod folders;
mod profiles;
mod serial;

pub use folders::*;
pub use profiles::*;
pub use serial::*;

use crate::*;

/// Represents the result of a command execution.
/// At the core level, this type is used for all commands invoked within an `UnboundSession`.
/// It is only used to indicate the successful completion or interruption of a command.
#[derive(Clone, Serialize, Deserialize, Debug)]
#[serde(bound(deserialize = "T: DeserializeOwned"))]
#[extend::encode_decode]
pub enum CommandOutcome<T: Serialize + DeserializeOwned> {
    /// Indicates that the command was successfully completed.
    Finished(T),
    /// Indicates that the command execution was interrupted.
    Cancelled,
}

/// Similar to `CommandOutcome`, but additionally contains the identifier of the executed command.
#[derive(Clone, Serialize, Deserialize, Debug)]
pub enum UuidCommandOutcome<T: Serialize> {
    /// Indicates that the command was successfully completed.
    Finished((Uuid, T)),
    /// Indicates that the command execution was interrupted.
    Cancelled(Uuid),
}
