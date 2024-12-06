use crate::*;

impl LifecycleTransition {
    /// Retrieves the `Uuid` associated with the lifecycle transition.
    ///
    /// # Returns
    /// - The `Uuid` of the operation, regardless of its state.
    pub fn uuid(&self) -> Uuid {
        match self {
            Self::Started { uuid, alias: _ } => *uuid,
            Self::Ticks { uuid, ticks: _ } => *uuid,
            Self::Stopped(uuid) => *uuid,
        }
    }

    /// Creates a new `LifecycleTransition::Started` instance.
    ///
    /// # Parameters
    /// - `uuid`: The unique identifier of the operation.
    /// - `alias`: A user-friendly name for the operation.
    ///
    /// # Returns
    /// - A new `LifecycleTransition::Started` instance.
    pub fn started(uuid: &Uuid, alias: &str) -> Self {
        LifecycleTransition::Started {
            uuid: *uuid,
            alias: alias.to_owned(),
        }
    }

    /// Creates a new `LifecycleTransition::Stopped` instance.
    ///
    /// # Parameters
    /// - `uuid`: The unique identifier of the operation.
    ///
    /// # Returns
    /// - A new `LifecycleTransition::Stopped` instance.
    pub fn stopped(uuid: &Uuid) -> Self {
        LifecycleTransition::Stopped(*uuid)
    }

    /// Creates a new `LifecycleTransition::Ticks` instance.
    ///
    /// # Parameters
    /// - `uuid`: The unique identifier of the operation.
    /// - `ticks`: Progress information associated with the operation.
    ///
    /// # Returns
    /// - A new `LifecycleTransition::Ticks` instance.
    pub fn ticks(uuid: &Uuid, ticks: Ticks) -> Self {
        LifecycleTransition::Ticks { uuid: *uuid, ticks }
    }
}
