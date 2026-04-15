//! Recent-session model types and session-derived behavior.
//!
//! This module defines the persisted recent-session snapshot, its source and
//! state subtypes, and the reopen/display helpers derived from that snapshot.

use std::{path::PathBuf, sync::Arc};

use itertools::Itertools;
use log::warn;
use serde::{Deserialize, Serialize};
use stypes::{FileFormat, ObserveOptions, ObserveOrigin, ParserType, Transport};
use uuid::Uuid;

use processor::search::filter::SearchFilter;

use super::source_key;

/// One stored recent-session snapshot.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecentSessionSnapshot {
    /// Stable logical identity for one ordered source snapshot.
    pub source_key: Arc<str>,
    /// Unix timestamp used to keep the list newest-first.
    pub last_opened: u64,
    /// Ordered source snapshot used for reopen flows and identity.
    sources: Vec<RecentSessionSource>,
    /// Cached recent-entry strings derived from `sources`.
    #[serde(skip, default)]
    cache: RecentEntryCache,
    /// Stored parser configuration.
    pub parser: ParserType,
    /// Stored restorable session-state snapshot.
    pub state: RecentSessionStateSnapshot,
}

/// Cached recent-entry strings derived from ordered sources.
#[derive(Debug, Clone, Default)]
struct RecentEntryCache {
    title: String,
    summary: String,
}

/// Static metadata used to register and update one live recent session.
#[derive(Debug, Clone)]
pub struct RecentSessionRegistration {
    /// Stable logical identity for one ordered source snapshot.
    pub source_key: Arc<str>,
    /// Unix timestamp used to keep the list newest-first.
    pub last_opened: u64,
    /// Ordered source snapshot used for reopen flows and identity.
    sources: Vec<RecentSessionSource>,
    /// Stored parser configuration.
    pub parser: ParserType,
}

/// Reopen intent for a recent-session snapshot.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RecentSessionReopenMode {
    RestoreSession,
    RestoreParserConfiguration,
    OpenClean,
}

/// One source item within a recent-session snapshot.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum RecentSessionSource {
    File { format: FileFormat, path: PathBuf },
    Stream { transport: Transport },
}

/// Stored semantic state for reopening a session.
#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, Eq)]
pub struct RecentSessionStateSnapshot {
    pub filters: Vec<SearchFilterSnapshot>,
    pub search_values: Vec<SearchFilterSnapshot>,
    pub bookmarks: Vec<u64>,
}

/// Stored semantic filter or search-value row.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct SearchFilterSnapshot {
    pub filter: SearchFilter,
    pub enabled: bool,
}

impl RecentSessionRegistration {
    /// Creates static recent-session metadata from explicit runtime parts.
    pub fn new(last_opened: u64, sources: Vec<RecentSessionSource>, parser: ParserType) -> Self {
        let source_key = source_key::from_sources(&sources);

        Self {
            source_key,
            last_opened,
            sources,
            parser,
        }
    }

    /// Returns whether this source shape supports bookmark persistence.
    pub fn supports_bookmarks(&self) -> bool {
        supports_bookmarks(&self.sources)
    }

    /// Converts this registration into a stored snapshot by attaching canonical runtime state.
    pub fn into_snapshot(self, state: RecentSessionStateSnapshot) -> RecentSessionSnapshot {
        RecentSessionSnapshot::new(self.last_opened, self.sources, self.parser, state)
    }
}

impl RecentSessionSnapshot {
    pub fn new(
        last_opened: u64,
        sources: Vec<RecentSessionSource>,
        parser: ParserType,
        state: RecentSessionStateSnapshot,
    ) -> Self {
        let source_key = source_key::from_sources(&sources);
        let cache = RecentEntryCache {
            title: build_title(&sources),
            summary: build_summary(&sources),
        };

        Self {
            source_key,
            last_opened,
            sources,
            cache,
            parser,
            state,
        }
    }

    pub fn title(&self) -> &str {
        &self.cache.title
    }

    pub fn summary(&self) -> &str {
        &self.cache.summary
    }

    pub fn sources(&self) -> &[RecentSessionSource] {
        &self.sources
    }

    pub fn into_sources(self) -> Vec<RecentSessionSource> {
        self.sources
    }

    pub(super) fn update_title_and_summary(&mut self) {
        self.cache = RecentEntryCache {
            title: build_title(&self.sources),
            summary: build_summary(&self.sources),
        };
    }

    /// Rebuilds the startup observe plan for restore-style reopen flows.
    pub fn to_startup_restore_plan(&self) -> Option<(ObserveOptions, Vec<ObserveOrigin>)> {
        // Source types can't be mixed in one session.
        let first = self.sources.first()?;

        let (origin, additional_sources) = match first {
            RecentSessionSource::File { .. } => {
                let mut files = Vec::with_capacity(self.sources.len());
                for source in &self.sources {
                    let RecentSessionSource::File { format, path } = source else {
                        warn!(
                            "Recent source snapshot contains mixed source types and cannot be restored"
                        );
                        return None;
                    };
                    files.push((Uuid::new_v4().to_string(), *format, path.clone()));
                }

                let origin = if files.len() == 1 {
                    let (id, format, path) = files.pop()?;
                    ObserveOrigin::File(id, format, path)
                } else {
                    ObserveOrigin::Concat(files)
                };

                (origin, Vec::new())
            }
            RecentSessionSource::Stream { .. } => {
                let mut origins = Vec::with_capacity(self.sources.len());
                for source in &self.sources {
                    let RecentSessionSource::Stream { transport } = source else {
                        warn!(
                            "Recent source snapshot contains mixed source types and cannot be restored"
                        );
                        return None;
                    };
                    origins.push(ObserveOrigin::Stream(
                        Uuid::new_v4().to_string(),
                        transport.clone(),
                    ));
                }

                let mut origins = origins.into_iter();
                let initial = origins.next()?;
                (initial, origins.collect())
            }
        };

        let options = ObserveOptions {
            origin,
            parser: self.parser.clone(),
        };

        Some((options, additional_sources))
    }

    /// Returns whether the snapshot can be reopened through the normal open/setup flow.
    pub fn supports_clean_open(&self) -> bool {
        supports_clean_open(&self.sources)
    }
}

impl RecentSessionSource {
    pub fn from_observe_origin(origin: ObserveOrigin) -> Vec<Self> {
        match origin {
            ObserveOrigin::File(_, format, path) => {
                vec![RecentSessionSource::File { format, path }]
            }
            ObserveOrigin::Concat(files) => files
                .into_iter()
                .map(|(_, format, path)| RecentSessionSource::File { format, path })
                .collect(),
            ObserveOrigin::Stream(_, transport) => {
                vec![RecentSessionSource::Stream { transport }]
            }
        }
    }
}

fn build_title(sources: &[RecentSessionSource]) -> String {
    if sources.is_empty() {
        return String::from("No sources");
    }

    sources
        .iter()
        .map(|source| match source {
            RecentSessionSource::File { path, .. } => path
                .file_name()
                .and_then(|name| name.to_str())
                .map(str::to_owned)
                .unwrap_or_else(|| path.display().to_string()),
            RecentSessionSource::Stream { transport } => match transport {
                Transport::Process(config) => config.command.clone(),
                Transport::TCP(config) => config.bind_addr.clone(),
                Transport::UDP(config) => config.bind_addr.clone(),
                Transport::Serial(config) => config.path.clone(),
            },
        })
        .join(" & ")
}

fn build_summary(sources: &[RecentSessionSource]) -> String {
    match sources.first() {
        Some(RecentSessionSource::File { path, .. }) if sources.len() == 1 => {
            path.display().to_string()
        }
        Some(RecentSessionSource::File { .. }) => format!("{} files", sources.len()),
        Some(RecentSessionSource::Stream { transport }) if sources.len() == 1 => match transport {
            Transport::Process(config) => config.command.clone(),
            Transport::TCP(config) => config.bind_addr.clone(),
            Transport::UDP(config) => config.bind_addr.clone(),
            Transport::Serial(config) => config.path.clone(),
        },
        Some(RecentSessionSource::Stream { transport }) => match transport {
            Transport::Process(_) => format!("{} terminal commands", sources.len()),
            Transport::TCP(_) => format!("{} TCP connections", sources.len()),
            Transport::UDP(_) => format!("{} UDP connections", sources.len()),
            Transport::Serial(_) => format!("{} serial connections", sources.len()),
        },
        None => String::from("No sources"),
    }
}

fn supports_clean_open(sources: &[RecentSessionSource]) -> bool {
    match sources.first() {
        Some(RecentSessionSource::File { .. }) => true,
        Some(RecentSessionSource::Stream { .. }) => sources.len() == 1,
        None => false,
    }
}

fn supports_bookmarks(sources: &[RecentSessionSource]) -> bool {
    matches!(sources.first(), Some(RecentSessionSource::File { .. }))
}

#[cfg(test)]
mod tests {
    use std::path::PathBuf;

    use stypes::{
        ObserveOptions, ObserveOrigin, ParserType, TCPTransportConfig, Transport,
        UDPTransportConfig,
    };

    use crate::common::time::unix_timestamp_now;

    use super::{RecentSessionRegistration, RecentSessionSnapshot, RecentSessionSource};

    fn snapshot_from_observe_options(options: ObserveOptions) -> RecentSessionSnapshot {
        RecentSessionRegistration::new(
            unix_timestamp_now(),
            RecentSessionSource::from_observe_origin(options.origin),
            options.parser,
        )
        .into_snapshot(Default::default())
    }

    fn stream_snapshot(bind_addr: &str) -> RecentSessionSnapshot {
        snapshot_from_observe_options(ObserveOptions {
            origin: ObserveOrigin::Stream(
                String::new(),
                Transport::TCP(TCPTransportConfig {
                    bind_addr: bind_addr.to_owned(),
                }),
            ),
            parser: ParserType::Text(()),
        })
    }

    #[test]
    fn title_joins_files() {
        let snapshot = snapshot_from_observe_options(ObserveOptions {
            origin: ObserveOrigin::Concat(vec![
                (
                    String::from("first-id"),
                    stypes::FileFormat::Text,
                    PathBuf::from("first.log"),
                ),
                (
                    String::from("second-id"),
                    stypes::FileFormat::Text,
                    PathBuf::from("second.log"),
                ),
            ]),
            parser: ParserType::Text(()),
        });

        assert_eq!(snapshot.title(), "first.log & second.log");
    }

    #[test]
    fn title_joins_streams() {
        let sources = vec![
            RecentSessionSource::Stream {
                transport: Transport::TCP(TCPTransportConfig {
                    bind_addr: String::from("127.0.0.1:5000"),
                }),
            },
            RecentSessionSource::Stream {
                transport: Transport::TCP(TCPTransportConfig {
                    bind_addr: String::from("127.0.0.1:5001"),
                }),
            },
        ];

        assert_eq!(
            super::build_title(&sources),
            "127.0.0.1:5000 & 127.0.0.1:5001"
        );
    }

    #[test]
    fn restore_rebuilds_ids() {
        let snapshot = snapshot_from_observe_options(ObserveOptions {
            origin: ObserveOrigin::Concat(vec![
                (
                    String::from("first-id"),
                    stypes::FileFormat::Text,
                    PathBuf::from("first.log"),
                ),
                (
                    String::from("second-id"),
                    stypes::FileFormat::Text,
                    PathBuf::from("second.log"),
                ),
            ]),
            parser: ParserType::Text(()),
        });

        let (restored, additional_sources) = snapshot
            .to_startup_restore_plan()
            .expect("startup restore plan should be rebuilt");

        assert!(additional_sources.is_empty());
        let ObserveOrigin::Concat(items) = restored.origin else {
            panic!("concat origin should be restored");
        };
        assert_eq!(items.len(), 2);
        assert_ne!(items[0].0, "first-id");
        assert_ne!(items[1].0, "second-id");
    }

    #[test]
    fn clean_open_matches_shape() {
        let files = snapshot_from_observe_options(ObserveOptions {
            origin: ObserveOrigin::Concat(vec![
                (
                    String::new(),
                    stypes::FileFormat::Text,
                    PathBuf::from("first.log"),
                ),
                (
                    String::new(),
                    stypes::FileFormat::Text,
                    PathBuf::from("second.log"),
                ),
            ]),
            parser: ParserType::Text(()),
        });
        let stream = stream_snapshot("127.0.0.1:5556");
        let invalid_multi_stream = RecentSessionSnapshot::new(
            1,
            vec![
                RecentSessionSource::Stream {
                    transport: Transport::TCP(TCPTransportConfig {
                        bind_addr: String::from("127.0.0.1:5000"),
                    }),
                },
                RecentSessionSource::Stream {
                    transport: Transport::UDP(UDPTransportConfig {
                        bind_addr: String::from("127.0.0.1:5001"),
                        multicast: Vec::new(),
                    }),
                },
            ],
            ParserType::Text(()),
            Default::default(),
        );

        assert!(files.supports_clean_open());
        assert!(stream.supports_clean_open());
        assert!(!invalid_multi_stream.supports_clean_open());
    }
}
