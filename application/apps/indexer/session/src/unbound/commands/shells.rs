use super::CommandOutcome;
use crate::unbound::signal::Signal;
use envvars;
use serde_json;

pub fn get_valid_profiles(
    _signal: Signal,
) -> Result<CommandOutcome<String>, stypes::ComputationError> {
    let mut profiles = envvars::get_profiles()
        .map_err(|e| stypes::ComputationError::IoOperation(e.to_string()))?;
    for profile in &mut profiles {
        if let Err(e) = profile.load() {
            log::warn!("Fail to load envvars for \"{}\": {e}", profile.name);
        }
    }
    Ok(CommandOutcome::Finished(
        serde_json::to_string(&profiles)
            .map_err(|e| stypes::ComputationError::IoOperation(e.to_string()))?,
    ))
}

pub fn get_context_envvars(
    _signal: Signal,
) -> Result<CommandOutcome<String>, stypes::ComputationError> {
    let envvars = envvars::get_context_envvars()
        .map_err(|e| stypes::ComputationError::IoOperation(e.to_string()))?;
    Ok(CommandOutcome::Finished(
        serde_json::to_string(&envvars)
            .map_err(|e| stypes::ComputationError::IoOperation(e.to_string()))?,
    ))
}
