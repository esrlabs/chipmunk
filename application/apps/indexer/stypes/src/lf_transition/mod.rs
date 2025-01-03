#[cfg(feature = "rustcore")]
mod extending;
#[cfg(feature = "nodejs")]
mod nodejs;
#[cfg(test)]
mod proptest;

use crate::*;

/// Describes the progress of an operation.
#[derive(Debug, Serialize, Deserialize, Clone)]
#[extend::encode_decode]
#[cfg_attr(
    all(test, feature = "test_and_gen"),
    derive(TS),
    ts(export, export_to = "lf_transition.ts")
)]
pub enum LifecycleTransition {
    /// The operation has started.
    Started {
        /// The unique identifier of the operation.
        uuid: Uuid,
        /// A user-friendly name of the operation for display purposes.
        alias: String,
    },
    /// The progress of the operation.
    Ticks {
        /// The unique identifier of the operation.
        uuid: Uuid,
        /// The progress data associated with the operation.
        ticks: Ticks,
    },
    /// The operation has completed or was interrupted.
    /// - `Uuid`: The unique identifier of the operation.
    Stopped(Uuid),
}
