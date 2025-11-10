use crate::unbound::signal::Signal;
// use envvars;

pub fn get_valid_profiles(
    _signal: Signal,
) -> Result<stypes::CommandOutcome<stypes::ProfileList>, stypes::ComputationError> {
    // let mut profiles = envvars::get_profiles()
    //     .map_err(|e| stypes::ComputationError::IoOperation(e.to_string()))?;
    // for profile in &mut profiles {
    //     if let Err(e) = profile.load() {
    //         log::warn!("Fail to load envvars for \"{}\": {e}", profile.name);
    //     }
    // }
    Ok(stypes::CommandOutcome::Finished(stypes::ProfileList(
        Vec::new(),
    )))
}

pub fn get_context_envvars(
    _signal: Signal,
) -> Result<stypes::CommandOutcome<stypes::MapKeyValue>, stypes::ComputationError> {
    // let envvars = envvars::get_context_envvars()
    //     .map_err(|e| stypes::ComputationError::IoOperation(e.to_string()))?;
    Ok(stypes::CommandOutcome::Finished(
        std::collections::HashMap::new().into(),
    ))
}
