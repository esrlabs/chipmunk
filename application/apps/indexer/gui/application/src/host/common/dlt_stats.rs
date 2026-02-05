use dlt_core::{
    dlt::LogLevel,
    parse::DltParseError,
    read::DltMessageReader,
    statistics::{Statistic, StatisticCollector, collect_statistics},
};
use rustc_hash::{FxHashMap, FxHashSet};
use std::{fs::File, path::PathBuf};

/// Collects the DLT statistics from the given source files.
pub fn dlt_statistics(sources: Vec<PathBuf>) -> Result<DltStatistics, String> {
    let mut statistics = DltStatistics::default();

    for source in sources {
        if let Ok(path) = source.clone().into_os_string().into_string()
            && let Ok(file) = File::open(path)
        {
            let mut reader = DltMessageReader::new(file, true);
            if let Err(error) = collect_statistics(&mut reader, &mut statistics) {
                return Err(format!("{:?}: {}", source, error));
            }
        } else {
            return Err(format!("invalid source: {:?}", source));
        }
    }

    Ok(statistics)
}

/// The statistics-info of DLT files.
#[derive(Debug, Default, Clone)]
pub struct DltStatistics {
    counter: usize,
    pub total: LevelDistribution,
    pub app_ids: FxHashMap<String, LevelDistribution>,
    pub ctx_ids: FxHashMap<String, LevelDistribution>,
    pub ecu_ids: FxHashMap<String, LevelDistribution>,
}

impl DltStatistics {
    pub fn count(&self) -> usize {
        self.app_ids.len() + self.ctx_ids.len() + self.ecu_ids.len()
    }
}

/// The Level distribution of DLT messages.
#[derive(Debug, Default, Clone)]
pub struct LevelDistribution {
    pub fatal: FxHashSet<usize>,
    pub error: FxHashSet<usize>,
    pub warn: FxHashSet<usize>,
    pub info: FxHashSet<usize>,
    pub debug: FxHashSet<usize>,
    pub verbose: FxHashSet<usize>,
    pub none: FxHashSet<usize>,
    pub invalid: FxHashSet<usize>,
}

impl LevelDistribution {
    pub fn count(&self) -> usize {
        self.fatal.len()
            + self.error.len()
            + self.warn.len()
            + self.info.len()
            + self.debug.len()
            + self.verbose.len()
            + self.none.len()
            + self.invalid.len()
    }

    pub fn values(&self) -> [usize; 8] {
        [
            self.fatal.len(),
            self.error.len(),
            self.warn.len(),
            self.info.len(),
            self.debug.len(),
            self.verbose.len(),
            self.none.len(),
            self.invalid.len(),
        ]
    }

    pub fn merge(&mut self, other: &LevelDistribution) -> &mut Self {
        self.fatal.extend(other.fatal.iter().copied());
        self.error.extend(other.error.iter().copied());
        self.warn.extend(other.warn.iter().copied());
        self.info.extend(other.info.iter().copied());
        self.debug.extend(other.debug.iter().copied());
        self.verbose.extend(other.verbose.iter().copied());
        self.none.extend(other.none.iter().copied());
        self.invalid.extend(other.invalid.iter().copied());
        self
    }

    pub fn intersect(&mut self, other: &LevelDistribution) -> &mut Self {
        self.fatal.retain(|item| other.fatal.contains(item));
        self.error.retain(|item| other.error.contains(item));
        self.warn.retain(|item| other.warn.contains(item));
        self.info.retain(|item| other.info.contains(item));
        self.debug.retain(|item| other.debug.contains(item));
        self.verbose.retain(|item| other.verbose.contains(item));
        self.none.retain(|item| other.none.contains(item));
        self.invalid.retain(|item| other.invalid.contains(item));
        self
    }
}

impl StatisticCollector for DltStatistics {
    fn collect_statistic(&mut self, statistic: Statistic) -> Result<(), DltParseError> {
        self.counter += 1;
        let msg = self.counter;

        let level = statistic.log_level;
        add_for_level(&mut self.total, level, msg);

        let header = statistic.standard_header;
        add_for_id(
            &mut self.ecu_ids,
            header.ecu_id.unwrap_or("NONE".to_string()),
            level,
            msg,
        );

        if let Some(header) = statistic.extended_header {
            add_for_id(&mut self.app_ids, header.application_id, level, msg);
            add_for_id(&mut self.ctx_ids, header.context_id, level, msg);
        }

        Ok(())
    }
}

fn add_for_id(
    ids: &mut FxHashMap<String, LevelDistribution>,
    id: String,
    level: Option<LogLevel>,
    msg: usize,
) {
    if let Some(levels) = ids.get_mut(&id) {
        add_for_level(levels, level, msg);
    } else {
        let mut levels = LevelDistribution::default();
        add_for_level(&mut levels, level, msg);
        ids.insert(id, levels);
    }
}

fn add_for_level(levels: &mut LevelDistribution, level: Option<LogLevel>, msg: usize) {
    match level {
        None => {
            levels.none.insert(msg);
        }
        Some(LogLevel::Fatal) => {
            levels.fatal.insert(msg);
        }
        Some(LogLevel::Error) => {
            levels.error.insert(msg);
        }
        Some(LogLevel::Warn) => {
            levels.warn.insert(msg);
        }
        Some(LogLevel::Info) => {
            levels.info.insert(msg);
        }
        Some(LogLevel::Debug) => {
            levels.debug.insert(msg);
        }
        Some(LogLevel::Verbose) => {
            levels.verbose.insert(msg);
        }
        Some(LogLevel::Invalid(_)) => {
            levels.invalid.insert(msg);
        }
    }
}
