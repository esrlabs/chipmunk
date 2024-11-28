use super::CommandOutcome;
use crate::{error::ComputationError, unbound::signal::Signal};
use processor::search::filter::{get_filter_error as validator, SearchFilter};

pub fn get_filter_error(
    filter: SearchFilter,
    _signal: Signal,
) -> Result<CommandOutcome<Option<String>>, ComputationError> {
    Ok(CommandOutcome::Finished(validator(&filter)))
}
