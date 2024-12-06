use crate::*;

impl<T: Serialize + DeserializeOwned> CommandOutcome<T> {
    /// Converts a `CommandOutcome<T>` into a `UuidCommandOutcome<T>`, associating it with a given `Uuid`.
    ///
    /// # Parameters
    /// - `self`: The `CommandOutcome<T>` instance to be converted.
    /// - `uuid`: The `Uuid` to associate with the resulting `UuidCommandOutcome`.
    ///
    /// # Returns
    /// - `UuidCommandOutcome::Cancelled` if the `CommandOutcome` is `Cancelled`.
    /// - `UuidCommandOutcome::Finished` if the `CommandOutcome` is `Finished`, pairing the given `Uuid` with the result.
    pub fn as_command_result(self, uuid: Uuid) -> UuidCommandOutcome<T> {
        match self {
            CommandOutcome::Cancelled => UuidCommandOutcome::Cancelled(uuid),
            CommandOutcome::Finished(c) => UuidCommandOutcome::Finished((uuid, c)),
        }
    }
}
