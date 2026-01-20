use std::{fmt::Display, path::PathBuf};

use chrono::{Offset, TimeZone, Utc};
use chrono_tz::Tz;
use dlt_core::{
    read::DltMessageReader,
    statistics::{
        collect_statistics,
        common::{LevelDistribution, StatisticInfo, StatisticInfoCollector},
    },
};
use itertools::Itertools;
use std::{collections::HashSet, fs::File};

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
    pub app_stats: DltStatisticConfig,
    pub context_stats: DltStatisticConfig,
    pub ecu_stats: DltStatisticConfig,
}

impl DltParserConfig {
    pub fn new(with_storage_header: bool, source_path: Option<PathBuf>) -> Self {
        let mut config = Self {
            with_storage_header,
            log_level: DltLogLevel::Verbose,
            fibex_files: Vec::new(),
            timezone: None,
            timezone_filter: String::new(),
            timezone_list: Self::timezone_list(),
            app_stats: DltStatisticConfig::new(),
            context_stats: DltStatisticConfig::new(),
            ecu_stats: DltStatisticConfig::new(),
        };

        if let Some(source) = source_path {
            if let Ok(path) = source.into_os_string().into_string() {
                if let Some(mut stats) = dlt_statistics([path].to_vec()) {
                    config.app_stats.ids_with_levels.append(&mut stats.app_ids);
                    config
                        .context_stats
                        .ids_with_levels
                        .append(&mut stats.context_ids);
                    config.ecu_stats.ids_with_levels.append(&mut stats.ecu_ids);
                }
            }
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

    pub fn summary(&self) -> DltStatisticSummary {
        let mut summary = DltStatisticSummary::default();

        let stats = [&self.app_stats, &self.context_stats, &self.ecu_stats];
        for stat in stats {
            summary.ids[0] += stat.ids_with_levels.len();
            summary.ids[1] += stat.selected_ids.len();

            for (_, levels) in &stat.ids_with_levels {
                summary.fatal[0] += levels.log_fatal;
                summary.error[0] += levels.log_error;
                summary.warn[0] += levels.log_warning;
                summary.info[0] += levels.log_info;
                summary.debug[0] += levels.log_debug;
                summary.verbose[0] += levels.log_verbose;
                summary.invalid[0] += levels.log_invalid;
                summary.none[0] += levels.non_log;

                summary.total[0] = levels.non_log
                    + levels.log_fatal
                    + levels.log_error
                    + levels.log_warning
                    + levels.log_info
                    + levels.log_debug
                    + levels.log_verbose
                    + levels.log_invalid
                    + levels.non_log;
            }

            for selected_id in &stat.selected_ids {
                if let Some((_, levels)) = stat
                    .ids_with_levels
                    .iter()
                    .find(|(id, _)| id == selected_id)
                {
                    summary.fatal[1] += levels.log_fatal;
                    summary.error[1] += levels.log_error;
                    summary.warn[1] += levels.log_warning;
                    summary.info[1] += levels.log_info;
                    summary.debug[1] += levels.log_debug;
                    summary.verbose[1] += levels.log_verbose;
                    summary.invalid[1] += levels.log_invalid;
                    summary.none[1] += levels.non_log;

                    summary.total[1] = levels.non_log
                        + levels.log_fatal
                        + levels.log_error
                        + levels.log_warning
                        + levels.log_info
                        + levels.log_debug
                        + levels.log_verbose
                        + levels.log_invalid
                        + levels.non_log;
                }
            }
        }

        summary
    }
}

#[derive(Debug, Clone)]
pub struct DltStatisticConfig {
    pub ids_with_levels: Vec<(String, LevelDistribution)>,
    pub selected_ids: HashSet<String>,
    pub column_sort: i8,
}

impl DltStatisticConfig {
    pub fn new() -> Self {
        DltStatisticConfig {
            ids_with_levels: Vec::new(),
            selected_ids: HashSet::new(),
            column_sort: 1, // ID column (ascending)
        }
    }
}

#[derive(Debug, Default)]
pub struct DltStatisticSummary {
    pub ids: [usize; 2],
    pub total: [usize; 2],
    pub fatal: [usize; 2],
    pub error: [usize; 2],
    pub warn: [usize; 2],
    pub info: [usize; 2],
    pub debug: [usize; 2],
    pub verbose: [usize; 2],
    pub invalid: [usize; 2],
    pub none: [usize; 2],
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

pub fn dlt_statistics(file_paths: Vec<String>) -> Option<StatisticInfo> {
    let mut statistics = StatisticInfo::new();

    file_paths.iter().for_each(|file_path| {
        if let Ok(file) = File::open(file_path) {
            let mut reader = DltMessageReader::new(file, true);
            let mut collector = StatisticInfoCollector::default();

            if collect_statistics(&mut reader, &mut collector).is_ok() {
                statistics.merge(collector.collect());
            }
        }
    });

    Some(statistics)
}
