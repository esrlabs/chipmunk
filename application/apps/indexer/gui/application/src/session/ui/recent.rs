use std::sync::Arc;

use tokio::sync::mpsc::Sender;

use crate::{
    host::ui::{
        UiActions,
        registry::filters::{FilterDefinition, FilterRegistry, SearchValueDefinition},
        storage::{RecentSessionStateSnapshot, SearchFilterSnapshot},
    },
    session::command::SessionCommand,
};

use super::shared::{SearchSyncTarget, SessionShared};

#[derive(Debug)]
pub struct RecentSessionRuntime {
    source_key: Arc<str>,
    supports_bookmarks: bool,
    //TODO AAZ:
    /// # NOTE:
    /// Temporary solution to stop recent session on adding new sources.
    /// However, this should removed once We extend recent sessions once
    /// new sources are added.
    /// Stops recent-session state updates once the live source identity no longer matches recents.
    updates_enabled: bool,
    last_revision: u64,
    pending_bookmark_restore: bool,
}

impl RecentSessionRuntime {
    /// Creates recent-session runtime tracking for one live session.
    pub fn new(source_key: Arc<str>, supports_bookmarks: bool) -> Self {
        Self {
            source_key,
            supports_bookmarks,
            updates_enabled: true,
            last_revision: 0,
            pending_bookmark_restore: false,
        }
    }

    /// Applies restored recent-session state through the normal session and registry path.
    pub fn apply_restore(
        &mut self,
        restore_state: RecentSessionStateSnapshot,
        shared: &mut SessionShared,
        actions: &mut UiActions,
        cmd_tx: &Sender<SessionCommand>,
        registry: &mut FilterRegistry,
    ) {
        let mut changed_filters = false;
        for snapshot in restore_state.filters {
            let filter_id = registry.add_filter(FilterDefinition::new(snapshot.filter));
            shared.apply_filter_with_state(registry, filter_id, snapshot.enabled);
            changed_filters = true;
        }

        let mut changed_search_values = false;
        for snapshot in restore_state.search_values {
            let value_id = registry.add_search_value(SearchValueDefinition::new(snapshot.filter));
            shared.apply_search_value_with_state(registry, value_id, snapshot.enabled);
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

        if let Some(target) = target {
            shared
                .sync_search_pipelines(registry, target)
                .into_iter()
                .for_each(|cmd| _ = actions.try_send_command(cmd_tx, cmd));
        }
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

    /// Disables further recent-session state updates for this live session.
    pub fn disable_updates(&mut self) {
        self.updates_enabled = false;
        self.pending_bookmark_restore = false;
    }

    /// Returns the stable recent-session identity for this live session.
    pub fn source_key(&self) -> &str {
        &self.source_key
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
        if !self.updates_enabled {
            return None;
        }

        if self.last_revision == shared.recent_revision() {
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
fn capture_state_snapshot(
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
                .map(|definition| SearchFilterSnapshot {
                    filter: definition.filter.clone(),
                    enabled: item.enabled,
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
                .map(|definition| SearchFilterSnapshot {
                    filter: definition.filter.clone(),
                    enabled: item.enabled,
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

    use processor::search::filter::SearchFilter;
    use stypes::{FileFormat, ObserveOrigin, TCPTransportConfig, Transport};
    use tokio::{runtime::Runtime, sync::mpsc};
    use uuid::Uuid;

    use crate::{
        host::{common::parsers::ParserNames, ui::UiActions},
        session::{types::ObserveOperation, ui::SessionInfo},
    };

    use super::*;

    fn new_shared(origin: ObserveOrigin) -> SessionShared {
        let session_info = SessionInfo {
            id: Uuid::new_v4(),
            title: String::from("test"),
            parser: ParserNames::Text,
        };
        let observe_op = ObserveOperation::new(Uuid::new_v4(), origin);
        SessionShared::new(session_info, observe_op)
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

        shared.apply_filter_with_state(&mut registry, first_filter, true);
        shared.apply_filter_with_state(&mut registry, second_filter, false);
        shared.apply_search_value_with_state(&mut registry, first_value, false);
        shared.apply_search_value_with_state(&mut registry, second_value, true);
        shared.insert_bookmark(9);
        shared.insert_bookmark(2);

        let state = file_runtime().capture_opened_state(&shared, &registry);

        assert_eq!(
            state.filters,
            vec![
                SearchFilterSnapshot {
                    filter: SearchFilter::plain("first"),
                    enabled: true,
                },
                SearchFilterSnapshot {
                    filter: SearchFilter::plain("second").regex(true),
                    enabled: false,
                },
            ]
        );
        assert_eq!(
            state.search_values,
            vec![
                SearchFilterSnapshot {
                    filter: SearchFilter::plain("value-1").ignore_case(true),
                    enabled: false,
                },
                SearchFilterSnapshot {
                    filter: SearchFilter::plain("value-2").word(true),
                    enabled: true,
                },
            ]
        );
        assert_eq!(state.bookmarks.len(), 2);
        assert!(state.bookmarks.contains(&2));
        assert!(state.bookmarks.contains(&9));
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

        recent.apply_restore(
            restore_state,
            &mut shared,
            &mut actions,
            &cmd_tx,
            &mut registry,
        );

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
}
