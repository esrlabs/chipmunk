use super::CommandOutcome;
use crate::{events::ComputationError, unbound::signal::Signal};
use std::path::Path;

use parsers::someip::{read_someip_statistic_from_pcapng, SomeipStatistic};

pub fn get_someip_statistic(
    files: Vec<String>,
    signal: Signal,
) -> Result<CommandOutcome<String>, ComputationError> {
    let mut statistic = SomeipStatistic::new();
    let mut error: Option<String> = None;
    files.iter().for_each(|file| {
        if error.is_some() {
            return;
        }
        if signal.is_cancelling() {
            return;
        }
        match read_someip_statistic_from_pcapng(Path::new(&file), &signal.token()) {
            Ok(result) => {
                statistic.merge(result);
            }
            Err(err) => {
                error = Some(err.to_string());
            }
        }
    });
    if let Some(err) = error {
        return Err(ComputationError::IoOperation(err));
    }
    if signal.is_cancelling() {
        return Ok(CommandOutcome::Cancelled);
    }
    Ok(CommandOutcome::Finished(
        serde_json::to_string(&statistic)
            .map_err(|e| ComputationError::IoOperation(e.to_string()))?,
    ))
}
