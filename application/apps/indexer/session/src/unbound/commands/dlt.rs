use crate::unbound::signal::Signal;
use dlt_core::{
    read::DltMessageReader,
    statistics::{
        collect_statistics,
        common::{StatisticInfo, StatisticInfoCollector},
    },
};
use std::fs::File;

pub fn stats(
    file_paths: Vec<String>,
    _signal: Signal,
) -> Result<stypes::CommandOutcome<stypes::DltStatisticInfo>, stypes::ComputationError> {
    let mut stat = StatisticInfo::new();
    let mut error: Option<String> = None;
    let mut timer = crate::Timer::new("collect statistics");
    file_paths.iter().for_each(|file_path| {
        if error.is_some() {
            return;
        }
        match File::open(file_path) {
            Ok(file) => {
                let mut reader = DltMessageReader::new(file, true);
                let mut collector = StatisticInfoCollector::default();

                match collect_statistics(&mut reader, &mut collector) {
                    Ok(()) => {
                        stat.merge(collector.collect());
                    }
                    Err(err) => {
                        error = Some(err.to_string());
                    }
                }
            }
            Err(err) => {
                error = Some(err.to_string());
            }
        }
    });
    timer.done();
    if let Some(err) = error {
        return Err(stypes::ComputationError::IoOperation(err));
    }
    Ok(stypes::CommandOutcome::Finished(stat.into()))
}
