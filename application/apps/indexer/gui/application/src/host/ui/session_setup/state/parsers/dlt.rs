use rustc_hash::{FxHashMap, FxHashSet};
use std::{fmt::Display, path::PathBuf};

use enum_iterator::Sequence;
use stypes::{DltParserSettings, ObserveOrigin};

use chrono::{Offset, TimeZone, Utc};
use chrono_tz::Tz;
use itertools::Itertools;

use super::FibexFileInfo;
use crate::host::common::dlt_stats::{DltStatistics, LevelDistribution};

/// DLT Configurations to be used in front-end
#[derive(Debug, Clone)]
pub struct DltParserConfig {
    pub with_storage_header: bool,
    pub log_level: DltLogLevel,
    pub source_paths: Option<Vec<PathBuf>>,
    pub fibex_files: Vec<FibexFileInfo>,
    pub timezone: Option<String>,
    pub timezone_filter: String,
    pub timezone_list: Vec<(String, i32)>,
    pub dlt_statistics: Option<Box<DltStatistics>>,
    pub dlt_summary: Box<DltSummary>,
    pub dlt_tables: Box<DltTables>,
}

impl DltParserConfig {
    pub fn new(with_storage_header: bool, source_paths: Option<Vec<PathBuf>>) -> Self {
        Self {
            with_storage_header,
            log_level: DltLogLevel::Verbose,
            source_paths,
            fibex_files: Vec::new(),
            timezone: None,
            timezone_filter: String::new(),
            timezone_list: Self::timezone_list(),
            dlt_statistics: None,
            dlt_summary: Box::new(DltSummary::default()),
            dlt_tables: Box::new(DltTables::default()),
        }
    }

    pub fn from_observe_options(settings: &DltParserSettings, origin: &ObserveOrigin) -> Self {
        let source_paths = match origin {
            ObserveOrigin::File(_, _, path_buf) => Some(vec![path_buf.to_owned()]),
            ObserveOrigin::Concat(items) => Some(
                items
                    .iter()
                    .map(|(_, _, path)| path.to_owned())
                    .collect_vec(),
            ),
            ObserveOrigin::Stream(..) => None,
        };

        Self {
            with_storage_header: settings.with_storage_header,
            log_level: settings
                .filter_config
                .as_ref()
                .and_then(|c| c.min_log_level)
                .and_then(|level| DltLogLevel::try_from(level).ok())
                .unwrap_or(DltLogLevel::Verbose),
            source_paths,
            fibex_files: settings
                .fibex_file_paths
                .as_ref()
                .map(|paths| {
                    paths
                        .iter()
                        .map(PathBuf::from)
                        .map(FibexFileInfo::from_path_lossy)
                        .collect_vec()
                })
                .unwrap_or_default(),
            timezone: settings.tz.to_owned(),
            timezone_list: Self::timezone_list(),
            timezone_filter: String::default(),
            dlt_statistics: None,
            dlt_summary: Box::new(DltSummary::default()),
            dlt_tables: Box::new(DltTables::default()),
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

    pub fn update_summary(&mut self) {
        if let Some(dlt_statistics) = &self.dlt_statistics {
            *self.dlt_summary = DltSummary::new(dlt_statistics, &self.dlt_tables);
        }
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

#[derive(Debug, Clone, Copy, PartialEq, PartialOrd, Ord, Eq, Sequence)]
pub enum DltLogLevel {
    Fatal = 1,
    Error = 2,
    Warn = 3,
    Info = 4,
    Debug = 5,
    Verbose = 6,
}

impl TryFrom<u8> for DltLogLevel {
    type Error = &'static str;

    fn try_from(value: u8) -> Result<Self, <DltLogLevel as TryFrom<u8>>::Error> {
        match value {
            1 => Ok(Self::Fatal),
            2 => Ok(Self::Error),
            3 => Ok(Self::Warn),
            4 => Ok(Self::Info),
            5 => Ok(Self::Debug),
            6 => Ok(Self::Verbose),
            _ => Err("Invalid DltLogLevel value"),
        }
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
