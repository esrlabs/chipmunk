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
use std::fs::File;

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
    pub sort_idxs: [i8; 3],
    pub app_ids: Vec<(String, LevelDistribution)>,
    pub context_ids: Vec<(String, LevelDistribution)>,
    pub ecu_ids: Vec<(String, LevelDistribution)>,
}

impl DltParserConfig {
    pub fn new(with_storage_header: bool, source_path: Option<PathBuf>) -> Self {
        let mut app_ids = Vec::new();
        let mut context_ids = Vec::new();
        let mut ecu_ids = Vec::new();

        if let Some(source) = source_path {
            if let Ok(path) = source.into_os_string().into_string() {
                if let Some(mut stats) = dlt_statistics([path].to_vec()) {
                    app_ids.append(&mut stats.app_ids);
                    ecu_ids.append(&mut stats.ecu_ids);
                    context_ids.append(&mut stats.context_ids);
                }
            }
        }

        Self {
            with_storage_header,
            log_level: DltLogLevel::Verbose,
            fibex_files: Vec::new(),
            timezone: None,
            timezone_filter: String::new(),
            timezone_list: Self::timezone_list(),
            sort_idxs: [1, 1, 1],
            app_ids,
            context_ids,
            ecu_ids,
        }
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
