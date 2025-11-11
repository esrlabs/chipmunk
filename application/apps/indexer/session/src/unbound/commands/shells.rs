//TODO AAZ: Temp solution to make it compile
use crate::unbound::signal::Signal;

pub fn get_valid_profiles(
    _signal: Signal,
) -> Result<stypes::CommandOutcome<stypes::ProfileList>, stypes::ComputationError> {
    Ok(stypes::CommandOutcome::Finished(stypes::ProfileList(
        Vec::new(),
    )))
}

pub fn get_context_envvars(
    _signal: Signal,
) -> Result<stypes::CommandOutcome<stypes::MapKeyValue>, stypes::ComputationError> {
    Ok(stypes::CommandOutcome::Finished(
        std::collections::HashMap::new().into(),
    ))
}
