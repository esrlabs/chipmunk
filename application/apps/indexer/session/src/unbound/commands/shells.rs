use crate::unbound::signal::Signal;

pub fn get_available_shells(
    _signal: Signal,
) -> Result<stypes::CommandOutcome<stypes::ProfileList>, stypes::ComputationError> {
    let shells = shell_tools::get_available_shells();
    Ok(stypes::CommandOutcome::Finished(stypes::ProfileList(
        shells.to_vec(),
    )))
}
