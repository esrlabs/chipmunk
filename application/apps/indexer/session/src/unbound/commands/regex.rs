use super::{CommandOutcome, Output};
use crate::{events::ComputationError, unbound::signal::Signal};
use processor::search::filter::{get_filter_error as validator, SearchFilter};

pub fn get_filter_error(
    filter: SearchFilter,
    _signal: Signal,
) -> Result<CommandOutcome, ComputationError> {
    Ok(CommandOutcome::Finished(Output::OptionString(validator(
        &filter,
    ))))
}
