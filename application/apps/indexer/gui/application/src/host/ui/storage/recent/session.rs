//! Recent-session model types and session-derived behavior.
//!
//! This module defines the persisted recent-session snapshot, its source and
//! state subtypes, and the reopen/display helpers derived from that snapshot.

use std::{fmt::Write as _, path::PathBuf, sync::Arc};

use itertools::Itertools;
use log::warn;
use serde::{Deserialize, Serialize};

use processor::search::filter::SearchFilter;
use stypes::{FileFormat, ObserveOptions, ObserveOrigin, ParserType, Transport};
use uuid::Uuid;

use crate::host::common::{parsers::ParserNames, sources::StreamNames};

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
    /// Cached recent-entry strings derived from source, parser, and stored state.
    #[serde(skip, default)]
    cache: RecentEntryCache,
    /// Stored parser configuration.
    pub parser: ParserType,
    /// Stored restorable session-state snapshot.
    pub state: RecentSessionStateSnapshot,
}

/// Cached recent-entry strings derived from ordered sources and stored state.
#[derive(Debug, Clone, Default)]
struct RecentEntryCache {
    title: String,
    summary: String,
    tooltip: String,
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
        let cache = build_cache(&sources, &parser, &state);

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

    pub fn tooltip(&self) -> &str {
        &self.cache.tooltip
    }

    pub fn sources(&self) -> &[RecentSessionSource] {
        &self.sources
    }

    pub fn into_sources(self) -> Vec<RecentSessionSource> {
        self.sources
    }

    pub fn rebuild_cache(&mut self) {
        self.cache = build_cache(&self.sources, &self.parser, &self.state);
    }

    pub fn parser_kind(&self) -> ParserNames {
        ParserNames::from(&self.parser)
    }

    /// Sessions only persist one stream kind, so the first stream source defines the kind.
    pub fn stream_kind(&self) -> Option<StreamNames> {
        match self.sources.first()? {
            RecentSessionSource::File { .. } => None,
            RecentSessionSource::Stream { transport } => {
                let stream_name = match transport {
                    Transport::Process(_) => StreamNames::Process,
                    Transport::TCP(_) => StreamNames::Tcp,
                    Transport::UDP(_) => StreamNames::Udp,
                    Transport::Serial(_) => StreamNames::Serial,
                };

                Some(stream_name)
            }
        }
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

fn build_cache(
    sources: &[RecentSessionSource],
    parser: &ParserType,
    state: &RecentSessionStateSnapshot,
) -> RecentEntryCache {
    RecentEntryCache {
        title: build_title(sources),
        summary: build_summary(sources, parser),
        tooltip: build_tooltip(sources, parser, state),
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

fn build_summary(sources: &[RecentSessionSource], parser: &ParserType) -> String {
    let parser_name = ParserNames::from(parser);
    format!("{} • {parser_name}", build_source_summary(sources))
}

fn build_source_summary(sources: &[RecentSessionSource]) -> String {
    match sources.first() {
        Some(RecentSessionSource::File { .. }) if sources.len() == 1 => String::from("1 file"),
        Some(RecentSessionSource::File { .. }) => format!("{} files", sources.len()),
        Some(RecentSessionSource::Stream { transport }) if sources.len() == 1 => match transport {
            Transport::Process(_) => String::from("1 terminal command"),
            Transport::TCP(_) => String::from("1 TCP connection"),
            Transport::UDP(_) => String::from("1 UDP connection"),
            Transport::Serial(_) => String::from("1 serial connection"),
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

fn build_tooltip(
    sources: &[RecentSessionSource],
    parser: &ParserType,
    state: &RecentSessionStateSnapshot,
) -> String {
    let mut tooltip = String::from("Sources:\n");
    append_source_tooltip_lines(&mut tooltip, sources);
    tooltip.push_str("\nParser:\n");
    append_parser_tooltip_lines(&mut tooltip, parser);
    tooltip.push_str("\nSaved state:\n");
    let _ = writeln!(tooltip, "- Filters: {}", state.filters.len());
    let _ = writeln!(tooltip, "- Charts: {}", state.search_values.len());
    let _ = write!(tooltip, "- Bookmarks: {}", state.bookmarks.len());
    tooltip
}

fn append_source_tooltip_lines(tooltip: &mut String, sources: &[RecentSessionSource]) {
    if sources.is_empty() {
        let _ = writeln!(tooltip, "- No sources");
        return;
    }

    for source in sources {
        match source {
            RecentSessionSource::File { format, path } => {
                let _ = writeln!(tooltip, "- File: {} ({format})", path.display(),);
            }
            RecentSessionSource::Stream { transport } => match transport {
                Transport::Process(config) => {
                    let _ = writeln!(tooltip, "- Terminal command: {}", config.command);
                    let _ = writeln!(tooltip, "  Working directory: {}", config.cwd.display());
                    if let Some(shell) = &config.shell {
                        let _ = writeln!(
                            tooltip,
                            "  Shell: {} ({})",
                            shell.shell,
                            shell.path.display()
                        );
                    }
                }
                Transport::TCP(config) => {
                    let _ = writeln!(tooltip, "- TCP: {}", config.bind_addr);
                }
                Transport::UDP(config) => {
                    let _ = writeln!(tooltip, "- UDP: {}", config.bind_addr);
                    if !config.multicast.is_empty() {
                        let _ = writeln!(tooltip, "  Multicast groups: {}", config.multicast.len());
                        for multicast in &config.multicast {
                            match &multicast.interface {
                                Some(interface) => {
                                    let _ = writeln!(
                                        tooltip,
                                        "    - {} via {}",
                                        multicast.multiaddr, interface
                                    );
                                }
                                None => {
                                    let _ = writeln!(tooltip, "    - {}", multicast.multiaddr);
                                }
                            }
                        }
                    }
                }
                Transport::Serial(config) => {
                    let _ = writeln!(tooltip, "- Serial port: {}", config.path);
                    let _ = writeln!(tooltip, "  Baud rate: {}", config.baud_rate);
                }
            },
        }
    }
}

fn append_parser_tooltip_lines(tooltip: &mut String, parser: &ParserType) {
    let parser_name = ParserNames::from(parser);
    let _ = writeln!(tooltip, "- Name: {parser_name}");

    match parser {
        ParserType::Text(()) => {}
        ParserType::Dlt(settings) => {
            let storage_header = if settings.with_storage_header {
                "Yes"
            } else {
                "No"
            };
            let _ = writeln!(tooltip, "- Storage header: {storage_header}");
            let _ = writeln!(
                tooltip,
                "- Message filter: {}",
                if settings.filter_config.is_some() {
                    "configured"
                } else {
                    "none"
                }
            );
            if let Some(timezone) = &settings.tz {
                let _ = writeln!(tooltip, "- Timezone: {timezone}");
            }
            append_path_list(tooltip, "FIBEX files", settings.fibex_file_paths.as_deref());
        }
        ParserType::SomeIp(settings) => {
            append_path_list(tooltip, "FIBEX files", settings.fibex_file_paths.as_deref());
        }
        ParserType::Plugin(settings) => {
            let _ = writeln!(tooltip, "- Plugin: {}", settings.plugin_path.display());
            let _ = writeln!(
                tooltip,
                "- Plugin configs: {}",
                settings.plugin_configs.len()
            );
        }
    }
}

fn append_path_list(tooltip: &mut String, label: &str, paths: Option<&[String]>) {
    match paths {
        Some(paths) if !paths.is_empty() => {
            let _ = writeln!(tooltip, "- {label}: {}", paths.len());
            for path in paths {
                let _ = writeln!(tooltip, "  - {path}");
            }
        }
        _ => {
            let _ = writeln!(tooltip, "- {label}: 0");
        }
    }
}

fn supports_clean_open(sources: &[RecentSessionSource]) -> bool {
    matches!(sources.first(), Some(RecentSessionSource::File { .. }))
}

fn supports_bookmarks(sources: &[RecentSessionSource]) -> bool {
    matches!(sources.first(), Some(RecentSessionSource::File { .. }))
}

#[cfg(test)]
mod tests {
    use std::path::PathBuf;

    use stypes::{
        DltParserSettings, ObserveOptions, ObserveOrigin, ParserType, TCPTransportConfig,
        Transport, UDPTransportConfig,
    };

    use crate::common::time::unix_timestamp_now;

    use super::{
        RecentSessionRegistration, RecentSessionSnapshot, RecentSessionSource,
        RecentSessionStateSnapshot, SearchFilterSnapshot,
    };

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
    fn summary_uses_counts_and_parser() {
        let snapshot = snapshot_from_observe_options(ObserveOptions::file(
            PathBuf::from("first.log"),
            stypes::FileFormat::Text,
            ParserType::Text(()),
        ));

        assert_eq!(snapshot.summary(), "1 file • Plain Text");
    }

    #[test]
    fn parser_kind_ignores_configuration_details() {
        let snapshot = snapshot_from_observe_options(ObserveOptions {
            origin: ObserveOrigin::Stream(
                String::new(),
                Transport::TCP(TCPTransportConfig {
                    bind_addr: String::from("127.0.0.1:5556"),
                }),
            ),
            parser: ParserType::SomeIp(stypes::SomeIpParserSettings {
                fibex_file_paths: Some(vec![String::from("/tmp/one.xml")]),
            }),
        });

        assert_eq!(
            snapshot.parser_kind(),
            crate::host::common::parsers::ParserNames::SomeIP
        );
    }

    #[test]
    fn stream_kind_uses_first_stream_source() {
        let snapshot = RecentSessionSnapshot::new(
            1,
            vec![
                RecentSessionSource::Stream {
                    transport: Transport::UDP(UDPTransportConfig {
                        bind_addr: String::from("127.0.0.1:5000"),
                        multicast: Vec::new(),
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

        assert_eq!(
            snapshot.stream_kind(),
            Some(crate::host::common::sources::StreamNames::Udp)
        );
    }

    #[test]
    fn file_snapshot_has_no_stream_kind() {
        let snapshot = snapshot_from_observe_options(ObserveOptions::file(
            PathBuf::from("first.log"),
            stypes::FileFormat::Text,
            ParserType::Text(()),
        ));

        assert!(snapshot.stream_kind().is_none());
    }

    #[test]
    fn tooltip_includes_details() {
        let snapshot = RecentSessionSnapshot::new(
            1,
            vec![
                RecentSessionSource::File {
                    format: stypes::FileFormat::Text,
                    path: PathBuf::from("/logs/first.log"),
                },
                RecentSessionSource::File {
                    format: stypes::FileFormat::PcapNG,
                    path: PathBuf::from("/logs/second.pcapng"),
                },
            ],
            ParserType::Dlt(DltParserSettings {
                filter_config: None,
                fibex_file_paths: Some(vec![
                    String::from("/fibex/a.xml"),
                    String::from("/fibex/b.xml"),
                ]),
                with_storage_header: true,
                tz: Some(String::from("UTC")),
                fibex_metadata: None,
            }),
            RecentSessionStateSnapshot {
                filters: vec![SearchFilterSnapshot {
                    filter: processor::search::filter::SearchFilter::plain("level=warn"),
                    enabled: true,
                }],
                search_values: vec![
                    SearchFilterSnapshot {
                        filter: processor::search::filter::SearchFilter::plain("cpu"),
                        enabled: true,
                    },
                    SearchFilterSnapshot {
                        filter: processor::search::filter::SearchFilter::plain("mem"),
                        enabled: false,
                    },
                ],
                bookmarks: vec![4, 9, 12],
            },
        );

        assert!(snapshot.tooltip().contains("Sources:"));
        assert!(
            snapshot
                .tooltip()
                .contains("- File: /logs/first.log (Text)"),
            "tooltip should include the full file path"
        );
        assert!(snapshot.tooltip().contains("Parser:"));
        assert!(snapshot.tooltip().contains("- Name: Dlt"));
        assert!(snapshot.tooltip().contains("- Storage header: Yes"));
        assert!(snapshot.tooltip().contains("- Timezone: UTC"));
        assert!(snapshot.tooltip().contains("- FIBEX files: 2"));
        assert!(snapshot.tooltip().contains("Saved state:"));
        assert!(snapshot.tooltip().contains("- Filters: 1"));
        assert!(snapshot.tooltip().contains("- Charts: 2"));
        assert!(snapshot.tooltip().contains("- Bookmarks: 3"));
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
        let multi_stream = RecentSessionSnapshot::new(
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
        assert!(!stream.supports_clean_open());
        assert!(!multi_stream.supports_clean_open());
    }
}
