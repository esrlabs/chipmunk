use crate::unbound::signal::Signal;
use processor::search::filter::{get_filter_error as validator, SearchFilter};

pub fn get_filter_error(
    filter: SearchFilter,
    _signal: Signal,
) -> Result<stypes::CommandOutcome<Option<String>>, stypes::ComputationError> {
    Ok(stypes::CommandOutcome::Finished(validator(&filter)))
}
