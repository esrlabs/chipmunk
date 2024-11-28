use super::{CommandOutcome, CommandOutcome::Finished};
use crate::error::{ComputationError, ComputationError::OperationNotSupported};
use file_tools::is_binary;

pub fn is_file_binary(file_path: String) -> Result<CommandOutcome<bool>, ComputationError> {
    is_binary(file_path)
        .map(Finished)
        .map_err(|err| OperationNotSupported(err.to_string()))
}
