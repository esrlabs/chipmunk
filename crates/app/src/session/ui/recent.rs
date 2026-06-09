use std::sync::Arc;

use tokio::sync::mpsc::Sender;

use crate::{
    host::{
        common::colors::{color_from_rgba, color_to_rgba},
        ui::{
            UiActions,
            registry::filters::{FilterDefinition, FilterRegistry, SearchValueDefinition},
            storage::recent::session::{
                RecentFilterSnapshot, RecentSearchValueSnapshot, RecentSessionStateSnapshot,
            },
        },
    },
    session::command::SessionCommand,
};

use super::shared::{SearchSyncOutcome, SearchSyncTarget, SessionShared};

#[derive(Debug)]
/// Runtime recent-session tracking for one live session.
pub struct RecentSessionRuntime {
    /// Current recent-session identity for this live session.
    ///
    /// When this is `None`, the session no longer participates in recent-session updates,
    /// for example after an append could not rebind because the old recent entry was removed.
    source_key: Option<Arc<str>>,
    /// Whether this session source shape supports bookmark persistence.
    supports_bookmarks: bool,
    /// Last observed recent-state revision from the session.
    last_revision: u64,
    /// True while restored bookmarks still need backend replay after file read completes.
    pending_bookmark_restore: bool,
    /// Restored searches waiting until the backend has created the session file.
    pending_search_restore: Option<SearchSyncTarget>,
}

impl RecentSessionRuntime {
    /// Creates recent-session runtime tracking for one live session.
    pub fn new(source_key: Arc<str>, supports_bookmarks: bool) -> Self {
        Self {
            source_key: Some(source_key),
            supports_bookmarks,
            last_revision: 0,
            pending_bookmark_restore: false,
            pending_search_restore: None,
        }
    }

    /// Creates a live-only session that never writes recent-session storage.
    pub fn untracked() -> Self {
        Self {
            source_key: None,
            supports_bookmarks: false,
            last_revision: 0,
            pending_bookmark_restore: false,
            pending_search_restore: None,
        }
    }

    /// Applies restored recent-session state and defers backend search until the session file exists.
    pub fn apply_restore(
        &mut self,
        restore_state: RecentSessionStateSnapshot,
        shared: &mut SessionShared,
        registry: &mut FilterRegistry,
    ) {
        let mut changed_filters = false;
        for snapshot in restore_state.filters {
            let filter_id = registry.add_filter(FilterDefinition::new(snapshot.filter));
            let colors = snapshot.colors.map(Into::into);
            shared.apply_filter_with_state(registry, filter_id, snapshot.enabled, colors);
            changed_filters = true;
        }

        let mut changed_search_values = false;
        for snapshot in restore_state.search_values {
            let value_id = registry.add_search_value(SearchValueDefinition::new(snapshot.filter));
            let color = snapshot.color.map(color_from_rgba);
            shared.apply_search_value_with_state(registry, value_id, snapshot.enabled, color);
            changed_search_values = true;
        }

        if self.supports_bookmarks {
            let bookmarks = restore_state.bookmarks;
            for row in &bookmarks {
                shared.insert_bookmark(*row);
            }
            self.pending_bookmark_restore = !bookmarks.is_empty();
        }

        let target = match (changed_filters, changed_search_values) {
            (false, false) => None,
            (true, false) => Some(SearchSyncTarget::Filter),
            (false, true) => Some(SearchSyncTarget::SearchValue),
            (true, true) => Some(SearchSyncTarget::Both),
        };

        self.pending_search_restore = target;
    }

    /// Returns restored search work once the backend has created the session file.
    pub fn on_session_file_ready(
        &mut self,
        shared: &mut SessionShared,
        registry: &FilterRegistry,
    ) -> Option<SearchSyncOutcome> {
        let target = self.pending_search_restore.take()?;

        let outcome = shared.sync_search_outcome(registry, target);
        Some(outcome)
    }

    /// Replays restored bookmarks into the backend once file loading completed.
    pub fn on_file_read_completed(
        &mut self,
        shared: &SessionShared,
        actions: &mut UiActions,
        cmd_tx: &Sender<SessionCommand>,
    ) {
        if !self.pending_bookmark_restore {
            return;
        }

        self.pending_bookmark_restore = false;
        let bookmarks = shared
            .logs
            .bookmarked_rows
            .iter()
            .copied()
            .collect::<Vec<_>>();

        if bookmarks.is_empty() {
            return;
        }

        actions.try_send_command(cmd_tx, SessionCommand::AddBookmarks(bookmarks));
    }

    /// Switches this live session to the provided recent-session source key.
    pub fn set_source_key(&mut self, source_key: Arc<str>) {
        self.source_key = Some(source_key);
    }

    /// Detaches this live session from recent-session tracking.
    pub fn clear_source_key(&mut self) {
        self.source_key = None;
        self.pending_bookmark_restore = false;
        self.pending_search_restore = None;
    }

    /// Returns the stable recent-session identity for this live session.
    pub fn source_key(&self) -> Option<&Arc<str>> {
        self.source_key.as_ref()
    }

    /// Captures the canonical recent-session state and establishes the update baseline.
    pub fn capture_opened_state(
        &mut self,
        shared: &SessionShared,
        registry: &FilterRegistry,
    ) -> RecentSessionStateSnapshot {
        self.sync_revision(shared);
        capture_state_snapshot(shared, registry, self.supports_bookmarks)
    }

    /// Returns the next recent-session state update when tracked state changed.
    pub fn take_state_update(
        &mut self,
        shared: &SessionShared,
        registry: &FilterRegistry,
    ) -> Option<RecentSessionStateSnapshot> {
        if self.source_key.is_none() || self.last_revision == shared.recent_revision() {
            return None;
        }

        self.sync_revision(shared);
        Some(capture_state_snapshot(
            shared,
            registry,
            self.supports_bookmarks,
        ))
    }

    /// Stores the current recent-state revision as the latest observed baseline.
    fn sync_revision(&mut self, shared: &SessionShared) {
        self.last_revision = shared.recent_revision();
    }
}

/// Captures the persisted recent-session state from the current live session state.
pub fn capture_state_snapshot(
    shared: &SessionShared,
    registry: &FilterRegistry,
    supports_bookmarks: bool,
) -> RecentSessionStateSnapshot {
    let filters = shared
        .filters
        .filter_entries
        .iter()
        .filter_map(|item| {
            registry
                .get_filter(&item.id)
                .map(|definition| RecentFilterSnapshot {
                    filter: definition.filter.clone(),
                    enabled: item.enabled,
                    colors: Some(item.colors.clone().into()),
                })
        })
        .collect();

    let search_values = shared
        .filters
        .search_value_entries
        .iter()
        .filter_map(|item| {
            registry
                .get_search_value(&item.id)
                .map(|definition| RecentSearchValueSnapshot {
                    filter: definition.filter.clone(),
                    enabled: item.enabled,
                    color: Some(color_to_rgba(item.color)),
                })
        })
        .collect();

    let bookmarks = if supports_bookmarks {
        shared
            .logs
            .bookmarked_rows
            .iter()
            .copied()
            .collect::<Vec<_>>()
    } else {
        Vec::new()
    };

    RecentSessionStateSnapshot {
        filters,
        search_values,
        bookmarks,
    }
}

#[cfg(test)]
mod tests {
    use std::path::PathBuf;

    use egui::Color32;
    use tokio::{runtime::Runtime, sync::mpsc};
    use uuid::Uuid;

    use processor::search::filter::SearchFilter;
    use stypes::{FileFormat, ObserveOrigin, TCPTransportConfig, Transport};

    use crate::{
        host::{
            common::{
                colors,
                colors::{ColorPair, StoredColorPair, color_to_rgba},
                parsers::ParserNames,
            },
            ui::UiActions,
        },
        session::{types::ObserveOperation, ui::SessionInfo},
    };

    use super::*;
    use crate::session::ui::definitions::schema::LogSchemaSpec;

    fn new_shared(origin: ObserveOrigin) -> SessionShared {
        let session_info = SessionInfo {
            id: Uuid::new_v4(),
            title: String::from("test"),
            parser: ParserNames::Text,
            raw_export_supported: false,
        };
        let observe_op = ObserveOperation::new(Uuid::new_v4(), origin);
        SessionShared::new(session_info, observe_op, LogSchemaSpec::Text)
    }

    fn file_runtime() -> RecentSessionRuntime {
        RecentSessionRuntime::new(Arc::<str>::from("recent-source-key"), true)
    }

    #[test]
    fn captures_state_order() {
        let mut shared = new_shared(ObserveOrigin::File(
            String::from("source"),
            FileFormat::Text,
            PathBuf::from("source.log"),
        ));
        let mut registry = FilterRegistry::default();

        let first_filter = registry.add_filter(FilterDefinition::new(SearchFilter::plain("first")));
        let second_filter = registry.add_filter(FilterDefinition::new(
            SearchFilter::plain("second").regex(true),
        ));
        let first_value = registry.add_search_value(SearchValueDefinition::new(
            SearchFilter::plain("value-1").ignore_case(true),
        ));
        let second_value = registry.add_search_value(SearchValueDefinition::new(
            SearchFilter::plain("value-2").word(true),
        ));

        shared.apply_filter_with_state(&mut registry, first_filter, true, None);
        shared.apply_filter_with_state(&mut registry, second_filter, false, None);
        shared.apply_search_value_with_state(&mut registry, first_value, false, None);
        shared.apply_search_value_with_state(&mut registry, second_value, true, None);
        shared.insert_bookmark(9);
        shared.insert_bookmark(2);

        let state = file_runtime().capture_opened_state(&shared, &registry);

        let first_filter_colors = colors::FILTER_HIGHLIGHT_COLORS[0].clone().into();
        let second_filter_colors = colors::FILTER_HIGHLIGHT_COLORS[1].clone().into();
        assert_eq!(
            state.filters,
            vec![
                RecentFilterSnapshot {
                    filter: SearchFilter::plain("first"),
                    enabled: true,
                    colors: Some(first_filter_colors),
                },
                RecentFilterSnapshot {
                    filter: SearchFilter::plain("second").regex(true),
                    enabled: false,
                    colors: Some(second_filter_colors),
                },
            ]
        );
        let first_value_color = color_to_rgba(colors::search_value_color(0));
        let second_value_color = color_to_rgba(colors::search_value_color(1));
        assert_eq!(
            state.search_values,
            vec![
                RecentSearchValueSnapshot {
                    filter: SearchFilter::plain("value-1").ignore_case(true),
                    enabled: false,
                    color: Some(first_value_color),
                },
                RecentSearchValueSnapshot {
                    filter: SearchFilter::plain("value-2").word(true),
                    enabled: true,
                    color: Some(second_value_color),
                },
            ]
        );
        assert_eq!(state.bookmarks.len(), 2);
        assert!(state.bookmarks.contains(&2));
        assert!(state.bookmarks.contains(&9));
    }

    #[test]
    fn captures_custom_colors() {
        let mut shared = new_shared(ObserveOrigin::File(
            String::from("source"),
            FileFormat::Text,
            PathBuf::from("source.log"),
        ));
        let mut registry = FilterRegistry::default();
        let filter = SearchFilter::plain("first");
        let filter_id = registry.add_filter(FilterDefinition::new(filter));
        let search_value = SearchFilter::plain("value=(\\d+)");
        let value_id = registry.add_search_value(SearchValueDefinition::new(search_value));
        shared.apply_filter(&mut registry, filter_id);
        shared.apply_search_value(&mut registry, value_id);
        let filter_colors = ColorPair::new(Color32::from_rgb(1, 2, 3), Color32::from_rgb(4, 5, 6));
        let value_color = Color32::from_rgb(7, 8, 9);
        shared.set_filter_colors(&filter_id, filter_colors.clone());
        shared.set_search_value_color(&value_id, value_color);

        let state = file_runtime().capture_opened_state(&shared, &registry);

        assert_eq!(state.filters[0].colors, Some(filter_colors.into()));
        assert_eq!(
            state.search_values[0].color,
            Some(color_to_rgba(value_color))
        );
    }

    #[test]
    fn registration_sets_update_baseline() {
        let mut shared = new_shared(ObserveOrigin::File(
            String::from("source"),
            FileFormat::Text,
            PathBuf::from("source.log"),
        ));
        let mut registry = FilterRegistry::default();
        let filter_id = registry.add_filter(FilterDefinition::new(SearchFilter::plain("first")));
        shared.apply_filter(&mut registry, filter_id);
        let mut recent = file_runtime();

        let opened = recent.capture_opened_state(&shared, &registry);

        assert_eq!(opened.filters.len(), 1);
        assert!(recent.take_state_update(&shared, &registry).is_none());

        shared.insert_bookmark(4);

        assert!(recent.take_state_update(&shared, &registry).is_some());
    }

    #[test]
    fn pinning_temp_filter_updates_state() {
        let mut shared = new_shared(ObserveOrigin::File(
            String::from("source"),
            FileFormat::Text,
            PathBuf::from("source.log"),
        ));
        let mut registry = FilterRegistry::default();
        let mut recent = file_runtime();

        let _ = recent.capture_opened_state(&shared, &registry);
        shared
            .filters
            .set_temp_search(SearchFilter::plain("status=ok").ignore_case(true));

        assert!(shared.pin_temp_search(&mut registry));

        let update = recent
            .take_state_update(&shared, &registry)
            .expect("pinning a temp filter should update recent state");

        assert_eq!(update.filters.len(), 1);
        assert_eq!(
            update.filters[0].filter,
            SearchFilter::plain("status=ok").ignore_case(true)
        );
        assert!(update.filters[0].enabled);
    }

    #[test]
    fn pinning_temp_value_updates_state() {
        let mut shared = new_shared(ObserveOrigin::File(
            String::from("source"),
            FileFormat::Text,
            PathBuf::from("source.log"),
        ));
        let mut registry = FilterRegistry::default();
        let mut recent = file_runtime();

        let _ = recent.capture_opened_state(&shared, &registry);
        shared.filters.set_temp_search(
            SearchFilter::plain("cpu=(\\d+)")
                .regex(true)
                .ignore_case(true),
        );

        assert!(shared.pin_temp_search_as_value(&mut registry));

        let update = recent
            .take_state_update(&shared, &registry)
            .expect("pinning a temp value should update recent state");

        assert_eq!(update.search_values.len(), 1);
        assert_eq!(
            update.search_values[0].filter,
            SearchFilter::plain("cpu=(\\d+)")
                .regex(true)
                .ignore_case(true)
        );
        assert!(update.search_values[0].enabled);
    }

    #[test]
    fn restore_applies_stored_colors() {
        let mut shared = new_shared(ObserveOrigin::File(
            String::from("source"),
            FileFormat::Text,
            PathBuf::from("source.log"),
        ));
        let mut registry = FilterRegistry::default();
        let mut recent = file_runtime();
        let colors = StoredColorPair {
            fg: [1, 2, 3, 4],
            bg: [5, 6, 7, 8],
        };
        let restore_state = RecentSessionStateSnapshot {
            filters: vec![RecentFilterSnapshot {
                filter: SearchFilter::plain("level=warn"),
                enabled: true,
                colors: Some(colors),
            }],
            search_values: vec![RecentSearchValueSnapshot {
                filter: SearchFilter::plain("cpu=(\\d+)"),
                enabled: true,
                color: Some([9, 10, 11, 12]),
            }],
            bookmarks: vec![],
        };

        recent.apply_restore(restore_state, &mut shared, &mut registry);

        assert_eq!(
            shared.filters.filter_entries[0].colors,
            ColorPair::new(
                Color32::from_rgba_unmultiplied(1, 2, 3, 4),
                Color32::from_rgba_unmultiplied(5, 6, 7, 8),
            )
        );
        assert_eq!(
            shared.filters.search_value_entries[0].color,
            Color32::from_rgba_unmultiplied(9, 10, 11, 12)
        );
    }

    #[test]
    fn restore_missing_colors_uses_defaults() {
        let mut shared = new_shared(ObserveOrigin::File(
            String::from("source"),
            FileFormat::Text,
            PathBuf::from("source.log"),
        ));
        let mut registry = FilterRegistry::default();
        let mut recent = file_runtime();
        let restore_state = RecentSessionStateSnapshot {
            filters: vec![RecentFilterSnapshot {
                filter: SearchFilter::plain("level=warn"),
                enabled: true,
                colors: None,
            }],
            search_values: vec![RecentSearchValueSnapshot {
                filter: SearchFilter::plain("cpu=(\\d+)"),
                enabled: true,
                color: None,
            }],
            bookmarks: vec![],
        };

        recent.apply_restore(restore_state, &mut shared, &mut registry);

        assert_eq!(
            shared.filters.filter_entries[0].colors,
            colors::FILTER_HIGHLIGHT_COLORS[0].clone()
        );
        assert_eq!(
            shared.filters.search_value_entries[0].color,
            colors::search_value_color(0)
        );
    }

    #[test]
    fn color_only_edit_updates_recent_state() {
        let mut shared = new_shared(ObserveOrigin::File(
            String::from("source"),
            FileFormat::Text,
            PathBuf::from("source.log"),
        ));
        let mut registry = FilterRegistry::default();
        let filter_id = registry.add_filter(FilterDefinition::new(SearchFilter::plain("first")));
        shared.apply_filter(&mut registry, filter_id);
        let mut recent = file_runtime();
        let _ = recent.capture_opened_state(&shared, &registry);

        shared.set_filter_colors(
            &filter_id,
            ColorPair::new(Color32::from_rgb(1, 2, 3), Color32::from_rgb(4, 5, 6)),
        );

        let update = recent
            .take_state_update(&shared, &registry)
            .expect("color-only edit should update recent state");

        let expected_colors = StoredColorPair {
            fg: [1, 2, 3, 255],
            bg: [4, 5, 6, 255],
        };
        assert_eq!(update.filters[0].colors, Some(expected_colors));
    }

    #[test]
    fn restore_search_waits_for_session_file_ready() {
        let runtime = Runtime::new().expect("runtime should initialize");
        let mut actions = UiActions::new(runtime.handle().clone());
        let (cmd_tx, mut cmd_rx) = mpsc::channel(8);
        let mut shared = new_shared(ObserveOrigin::File(
            String::from("source"),
            FileFormat::PcapNG,
            PathBuf::from("source.pcapng"),
        ));
        let mut registry = FilterRegistry::default();
        let mut recent = file_runtime();
        let filter = SearchFilter::plain("level=warn");
        let search_value = SearchFilter::plain("cpu=(\\d+)");
        let restore_state = RecentSessionStateSnapshot {
            filters: vec![RecentFilterSnapshot {
                filter: filter.clone(),
                enabled: true,
                colors: None,
            }],
            search_values: vec![RecentSearchValueSnapshot {
                filter: search_value.clone(),
                enabled: true,
                color: None,
            }],
            bookmarks: vec![],
        };

        recent.apply_restore(restore_state, &mut shared, &mut registry);

        assert!(cmd_rx.try_recv().is_err());

        let outcome = recent
            .on_session_file_ready(&mut shared, &registry)
            .expect("restored search should be ready");
        let SearchSyncOutcome {
            commands,
            log_search_dropped,
        } = outcome;

        assert!(log_search_dropped);
        assert!(shared.signals.is_empty());

        for cmd in commands {
            actions.try_send_command(&cmd_tx, cmd);
        }

        match cmd_rx.try_recv() {
            Ok(SessionCommand::ApplySearchFilter { filters, .. }) => {
                assert_eq!(filters, vec![filter]);
            }
            other => panic!("expected ApplySearchFilter command, got {other:?}"),
        }

        match cmd_rx.try_recv() {
            Ok(SessionCommand::ApplySearchValuesFilter { filters, .. }) => {
                assert_eq!(filters, vec![search_value.value]);
            }
            other => panic!("expected ApplySearchValuesFilter command, got {other:?}"),
        }

        assert!(cmd_rx.try_recv().is_err());

        let outcome = recent.on_session_file_ready(&mut shared, &registry);

        assert!(outcome.is_none());
        assert!(shared.signals.is_empty());
        assert!(cmd_rx.try_recv().is_err());
    }

    #[test]
    fn restore_waits_for_file_read() {
        let runtime = Runtime::new().expect("runtime should initialize");
        let mut actions = UiActions::new(runtime.handle().clone());
        let (cmd_tx, mut cmd_rx) = mpsc::channel(8);
        let mut shared = new_shared(ObserveOrigin::File(
            String::from("source"),
            FileFormat::Text,
            PathBuf::from("source.log"),
        ));
        let mut registry = FilterRegistry::default();
        let mut recent = file_runtime();
        let restore_state = RecentSessionStateSnapshot {
            filters: vec![],
            search_values: vec![],
            bookmarks: vec![5, 2],
        };

        recent.apply_restore(restore_state, &mut shared, &mut registry);

        assert!(cmd_rx.try_recv().is_err());
        assert!(shared.logs.is_bookmarked(2));
        assert!(shared.logs.is_bookmarked(5));

        recent.on_file_read_completed(&shared, &mut actions, &cmd_tx);

        let rows = match cmd_rx.try_recv() {
            Ok(SessionCommand::AddBookmarks(rows)) => rows,
            other => panic!("expected AddBookmarks command, got {other:?}"),
        };

        assert_eq!(rows.len(), 2);
        assert!(rows.contains(&2));
        assert!(rows.contains(&5));
        assert!(cmd_rx.try_recv().is_err());
    }

    #[test]
    fn stream_skips_bookmarks() {
        let mut shared = new_shared(ObserveOrigin::Stream(
            String::from("source"),
            Transport::TCP(TCPTransportConfig {
                bind_addr: String::from("127.0.0.1:9000"),
            }),
        ));
        let registry = FilterRegistry::default();
        let mut recent = RecentSessionRuntime::new(Arc::<str>::from("stream-source-key"), false);

        shared.insert_bookmark(4);

        let state = recent.capture_opened_state(&shared, &registry);

        assert!(state.bookmarks.is_empty());
    }

    #[test]
    fn untracked_skips_state_updates() {
        let mut shared = new_shared(ObserveOrigin::File(
            String::from("source"),
            FileFormat::Text,
            PathBuf::from("source.log"),
        ));
        let mut registry = FilterRegistry::default();
        let mut recent = RecentSessionRuntime::untracked();

        let filter_id = registry.add_filter(FilterDefinition::new(SearchFilter::plain("first")));
        shared.apply_filter(&mut registry, filter_id);
        shared.insert_bookmark(4);

        assert!(recent.take_state_update(&shared, &registry).is_none());
        assert!(recent.source_key().is_none());
    }
}
