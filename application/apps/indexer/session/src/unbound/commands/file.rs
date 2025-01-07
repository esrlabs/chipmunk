use file_tools::is_binary;

pub fn is_file_binary(
    file_path: String,
) -> Result<stypes::CommandOutcome<bool>, stypes::ComputationError> {
    is_binary(file_path)
        .map(stypes::CommandOutcome::Finished)
        .map_err(|err| stypes::ComputationError::OperationNotSupported(err.to_string()))
}
