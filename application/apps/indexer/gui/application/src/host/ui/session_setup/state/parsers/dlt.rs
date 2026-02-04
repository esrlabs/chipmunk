use std::{fmt::Display, path::PathBuf};

use chrono::{Offset, TimeZone, Utc};
use chrono_tz::Tz;
use itertools::Itertools;
use rustc_hash::FxHashSet;
use statistics::DltStatistics;
use summary::DltSummary;

use super::FibexFileInfo;

/// DLT Configurations to be used in front-end
#[derive(Debug, Clone)]
pub struct DltParserConfig {
    pub with_storage_header: bool,
    pub log_level: DltLogLevel,
    pub fibex_files: Vec<FibexFileInfo>,
    pub timezone: Option<String>,
    pub timezone_filter: String,
    pub timezone_list: Vec<(String, i32)>,
    pub dlt_statistics: DltStatistics,
    pub dlt_summary: DltSummary,
    pub dlt_tables: DltTables,
}

impl DltParserConfig {
    pub fn new(with_storage_header: bool, source_paths: Option<Vec<PathBuf>>) -> Self {
        let mut config = Self {
            with_storage_header,
            log_level: DltLogLevel::Verbose,
            fibex_files: Vec::new(),
            timezone: None,
            timezone_filter: String::new(),
            timezone_list: Self::timezone_list(),
            dlt_statistics: DltStatistics::default(),
            dlt_summary: DltSummary::default(),
            dlt_tables: DltTables::default(),
        };

        if let Some(sources) = source_paths
            && let Some(statistics) = statistics::collect(sources)
        {
            config.dlt_statistics = statistics;
            config.update();
        }

        config
    }

    fn timezone_list() -> Vec<(String, i32)> {
        let now = Utc::now();

        let mut timezones = chrono_tz::TZ_VARIANTS
            .iter()
            .map(|tz: &Tz| {
                let local_time = tz.from_utc_datetime(&now.naive_utc());
                let offset = local_time.offset().fix();

                (tz.name().to_string(), offset.local_minus_utc())
            })
            .collect_vec();

        timezones.sort_by(|a, b| a.1.partial_cmp(&b.1).unwrap_or(std::cmp::Ordering::Equal));

        timezones
    }

    pub fn update(&mut self) {
        self.dlt_summary = DltSummary::new(&self.dlt_statistics, &self.dlt_tables);
    }
}

#[derive(Debug, Clone, Default)]
pub struct DltTables {
    pub app_table: TableConfig,
    pub ctx_table: TableConfig,
    pub ecu_table: TableConfig,
}

impl DltTables {
    pub fn count(&self) -> usize {
        self.app_table.selected_ids.len()
            + self.ctx_table.selected_ids.len()
            + self.ecu_table.selected_ids.len()
    }

    pub fn take_changed(&mut self) -> bool {
        self.app_table.take_changed()
            | self.ctx_table.take_changed()
            | self.ecu_table.take_changed()
    }
}

#[derive(Debug, Clone)]
pub struct TableConfig {
    pub selected_ids: FxHashSet<String>,
    pub column_sort: Option<(usize, bool)>,
    pub is_changed: bool,
    pub is_collapsed: bool,
}

impl Default for TableConfig {
    fn default() -> Self {
        TableConfig {
            selected_ids: FxHashSet::default(),
            column_sort: None,
            is_changed: false,
            is_collapsed: true,
        }
    }
}

impl TableConfig {
    pub fn take_changed(&mut self) -> bool {
        if self.is_changed {
            self.is_changed = false;
            return true;
        }

        false
    }
}

#[derive(Debug, Clone, Copy, PartialEq, PartialOrd, Ord, Eq)]
pub enum DltLogLevel {
    Fatal = 1,
    Error = 2,
    Warn = 3,
    Info = 4,
    Debug = 5,
    Verbose = 6,
}

impl DltLogLevel {
    pub const fn all() -> &'static [Self] {
        // Reminder to update on new types
        match DltLogLevel::Fatal {
            DltLogLevel::Fatal => {}
            DltLogLevel::Error => {}
            DltLogLevel::Warn => {}
            DltLogLevel::Info => {}
            DltLogLevel::Debug => {}
            DltLogLevel::Verbose => {}
        };

        &[
            DltLogLevel::Fatal,
            DltLogLevel::Error,
            DltLogLevel::Warn,
            DltLogLevel::Info,
            DltLogLevel::Debug,
            DltLogLevel::Verbose,
        ]
    }
}

impl Display for DltLogLevel {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let name = match self {
            DltLogLevel::Fatal => "Fatal",
            DltLogLevel::Error => "Error",
            DltLogLevel::Warn => "Warn",
            DltLogLevel::Info => "Info",
            DltLogLevel::Debug => "Debug",
            DltLogLevel::Verbose => "Verbose",
        };

        f.write_str(name)
    }
}

pub mod statistics {
    use dlt_core::{
        dlt::LogLevel,
        parse::DltParseError,
        read::DltMessageReader,
        statistics::collect_statistics,
        statistics::{Statistic, StatisticCollector},
    };
    use rustc_hash::{FxHashMap, FxHashSet};
    use std::{fs::File, path::PathBuf};

    pub fn collect(sources: Vec<PathBuf>) -> Option<DltStatistics> {
        let mut collector = DltStatistics::default();

        for source in sources {
            if let Ok(path) = source.into_os_string().into_string()
                && let Ok(file) = File::open(path)
            {
                let mut reader = DltMessageReader::new(file, true);
                if collect_statistics(&mut reader, &mut collector).is_err() {
                    return None;
                }
            } else {
                return None;
            }
        }

        Some(collector)
    }

    /// The statistics-info for a DLT file.
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
}

pub mod summary {
    use crate::host::ui::session_setup::state::parsers::dlt::DltTables;

    use super::statistics::{DltStatistics, LevelDistribution};
    use rustc_hash::{FxHashMap, FxHashSet};

    /// Provides a summary of the DLT statistics.
    #[derive(Debug, Default, Clone)]
    pub struct DltSummary {
        pub total: LevelSummary,
        pub selected: LevelSummary,
    }

    #[derive(Debug, Default, Clone)]
    pub struct LevelSummary {
        pub ids: usize,
        pub count: usize,
        pub levels: [usize; 8],
    }

    impl DltSummary {
        pub fn new(stats: &DltStatistics, tables: &DltTables) -> Self {
            let app_levels = collect(&tables.app_table.selected_ids, &stats.app_ids);
            let ctx_levels = collect(&tables.ctx_table.selected_ids, &stats.ctx_ids);
            let ecu_levels = collect(&tables.ecu_table.selected_ids, &stats.ecu_ids);

            let levels = match (app_levels, ctx_levels, ecu_levels) {
                (None, None, None) => LevelDistribution::default(),
                (Some(levels1), None, None) => levels1,
                (None, Some(levels1), None) => levels1,
                (None, None, Some(levels1)) => levels1,
                (Some(mut levels1), Some(levels2), None) => {
                    levels1.intersect(&levels2);
                    levels1
                }
                (Some(mut levels1), None, Some(levels2)) => {
                    levels1.intersect(&levels2);
                    levels1
                }
                (None, Some(mut levels1), Some(levels2)) => {
                    levels1.intersect(&levels2);
                    levels1
                }
                (Some(mut levels1), Some(levels2), Some(levels3)) => {
                    levels1.intersect(&levels2).intersect(&levels3);
                    levels1
                }
            };

            DltSummary {
                total: LevelSummary {
                    ids: stats.count(),
                    count: stats.total.count(),
                    levels: stats.total.values(),
                },
                selected: LevelSummary {
                    ids: tables.count(),
                    count: levels.count(),
                    levels: levels.values(),
                },
            }
        }
    }

    fn collect(
        selected_ids: &FxHashSet<String>,
        ids_with_level: &FxHashMap<String, LevelDistribution>,
    ) -> Option<LevelDistribution> {
        if selected_ids.is_empty() {
            None
        } else {
            Some(merge(selected_ids, ids_with_level))
        }
    }

    fn merge(
        selected_ids: &FxHashSet<String>,
        ids_with_level: &FxHashMap<String, LevelDistribution>,
    ) -> LevelDistribution {
        let mut levels = LevelDistribution::default();

        for selected_id in selected_ids {
            if let Some((_, l)) = ids_with_level.iter().find(|(id, _)| *id == selected_id) {
                levels.merge(l);
            }
        }

        levels
    }
}
