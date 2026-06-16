use super::FibexFileInfo;
use crate::host::common::someip_stats::{MessageDistribution, SomeipStatistics};
use itertools::Itertools;
use rustc_hash::{FxHashMap, FxHashSet};
use someip_messages::MessageId;
use std::path::PathBuf;
use stypes::{ObserveOrigin, SomeIpParserSettings};

#[derive(Debug, Clone, Default)]
pub struct SomeIpParserConfig {
    pub source_paths: Option<Vec<PathBuf>>,
    pub fibex_files: Vec<FibexFileInfo>,
    pub someip_statistics: Option<Box<SomeipStatistics>>,
    pub someip_summary: Box<SomeipSummary>,
    pub someip_tables: Box<SomeipTables>,
}

impl SomeIpParserConfig {
    pub fn new(source_paths: Option<Vec<PathBuf>>) -> Self {
        SomeIpParserConfig {
            source_paths,
            ..Self::default()
        }
    }

    pub fn from_observe_options(settings: &SomeIpParserSettings, origin: &ObserveOrigin) -> Self {
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

        let fibex_files = settings
            .fibex_file_paths
            .as_ref()
            .map(|paths| {
                paths
                    .iter()
                    .map(PathBuf::from)
                    .map(FibexFileInfo::from_path_lossy)
                    .collect_vec()
            })
            .unwrap_or_default();

        Self {
            source_paths,
            fibex_files,
            someip_statistics: None,
            someip_summary: Box::new(SomeipSummary::default()),
            someip_tables: Box::new(SomeipTables::default()),
        }
    }

    pub fn update_summary(&mut self) {
        if let Some(someip_statistics) = &self.someip_statistics {
            *self.someip_summary = SomeipSummary::new(someip_statistics, &self.someip_tables);
        }
    }
}

/// The summary on SOME/IP messages.
#[derive(Debug, Default, Clone)]
pub struct SomeipSummary {
    /// The summary on all messages.
    pub total: ServiceSummary,
    /// The summary on selected messages.
    pub selected: ServiceSummary,
}

impl SomeipSummary {
    pub fn new(stats: &SomeipStatistics, tables: &SomeipTables) -> Self {
        let messages =
            collect(&tables.message_table.selected_ids, &stats.messages).unwrap_or_default();

        SomeipSummary {
            total: ServiceSummary {
                ids: stats.count(),
                count: stats.total.count(),
                messages: stats.total.values(),
            },
            selected: ServiceSummary {
                ids: tables.count(),
                count: messages.count(),
                messages: messages.values(),
            },
        }
    }
}

/// A specific summary on SOME/IP messages.
#[derive(Debug, Default, Clone)]
pub struct ServiceSummary {
    /// The number of message ids.
    pub ids: usize,
    /// The total number of messages.
    pub count: usize,
    /// The specific number of message types.
    pub messages: [usize; 6],
}

#[derive(Debug, Clone, Default)]
pub struct SomeipTables {
    pub message_table: TableConfig,
}

impl SomeipTables {
    pub fn count(&self) -> usize {
        self.message_table.selected_ids.len()
    }

    pub fn take_changed(&mut self) -> bool {
        self.message_table.take_changed()
    }
}

#[derive(Debug, Clone)]
pub struct TableConfig {
    pub selected_ids: FxHashSet<MessageId>,
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

fn collect(
    selected_ids: &FxHashSet<MessageId>,
    ids_with_messages: &FxHashMap<MessageId, MessageDistribution>,
) -> Option<MessageDistribution> {
    if selected_ids.is_empty() {
        None
    } else {
        Some(merge(selected_ids, ids_with_messages))
    }
}

fn merge(
    selected_ids: &FxHashSet<MessageId>,
    ids_with_messages: &FxHashMap<MessageId, MessageDistribution>,
) -> MessageDistribution {
    let mut messages = MessageDistribution::default();

    for message in selected_ids
        .iter()
        .filter_map(|id| ids_with_messages.get(id))
    {
        messages.merge(message);
    }

    messages
}
