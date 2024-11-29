use crate::unbound::signal::Signal;
use dlt_core::statistics::{collect_dlt_stats, StatisticInfo};
use std::path::Path;

pub fn stats(
    files: Vec<String>,
    _signal: Signal,
) -> Result<stypes::CommandOutcome<String>, stypes::ComputationError> {
    let mut stat = StatisticInfo::new();
    let mut error: Option<String> = None;
    files.iter().for_each(|file| {
        if error.is_some() {
            return;
        }
        match collect_dlt_stats(Path::new(&file)) {
            Ok(res) => {
                stat.merge(res);
            }
            Err(err) => {
                error = Some(err.to_string());
            }
        }
    });
    if let Some(err) = error {
        return Err(stypes::ComputationError::IoOperation(err));
    }
    Ok(stypes::CommandOutcome::Finished(
        serde_json::to_string(&stat)
            .map_err(|e| stypes::ComputationError::IoOperation(e.to_string()))?,
    ))
}
