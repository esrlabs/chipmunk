use super::{CommandOutcome, CommandOutcome::Finished, Output};
use crate::events::{ComputationError, ComputationError::OperationNotSupported};
use file_tools::is_binary;

pub fn is_file_binary(file_path: String) -> Result<CommandOutcome, ComputationError> {
    is_binary(file_path)
        .map(|v| Finished(Output::Bool(v)))
        .map_err(|err| OperationNotSupported(err.to_string()))
}
