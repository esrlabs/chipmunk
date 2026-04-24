use crate::{
    host::ui::registry::filters::FilterRegistry,
    session::{
        command::SessionCommand,
        types::{ObserveOperation, OperationPhase},
        ui::{
            common::logs_tables,
            definitions::{UpdateOperationOutcome, schema::LogSchema},
        },
    },
};
use uuid::Uuid;

use super::{bottom_panel::BottomTabType, side_panel::SideTabType};

mod attachments;
mod info;
mod layout;
mod logs;
mod observe;
pub(crate) mod searching;
mod signal;

pub use attachments::AttachmentsState;
pub use info::SessionInfo;
pub use layout::UiLayoutState;
pub use logs::{LogsState, SelectionIntent};
pub use observe::ObserveState;
pub use signal::SessionSignal;

use self::searching::{FiltersState, SearchState, SearchValuesState};

#[derive(Debug)]
pub struct SessionShared {
    session_info: SessionInfo,

    pub signals: Vec<SessionSignal>,

    /// Active tab in bottom panel
    pub bottom_tab: BottomTabType,

    pub side_tab: SideTabType,

    pub filters: FiltersState,

    pub search: SearchState,
    pub search_values: SearchValuesState,

    pub logs: LogsState,

    pub layout: UiLayoutState,

    pub observe: ObserveState,

    pub attachments: AttachmentsState,

    /// Monotonic change marker for recent-session state updates.
    recent_revision: u64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
/// Selects which backend search pipeline(s) should be synchronized for a UI action.
pub(crate) enum SearchSyncTarget {
    /// Synchronize only the logs search pipeline (`ApplySearchFilter` / `DropSearch`).
    Filter,
    /// Synchronize only the chart search-values pipeline.
    SearchValue,
    /// Synchronize both pipelines in one pass.
    Both,
}

impl SessionShared {
    pub fn new(
        session_info: SessionInfo,
        observe_op: ObserveOperation,
        schema: &dyn LogSchema,
    ) -> Self {
        let session_id = session_info.id;
        Self {
            session_info,
            signals: Vec::new(),
            bottom_tab: BottomTabType::Search,
            side_tab: SideTabType::Filters,
            filters: FiltersState::new(session_id),
            search: SearchState::new(session_id),
            search_values: SearchValuesState::default(),
            logs: LogsState::default(),
            layout: UiLayoutState {
                log_columns: logs_tables::create_table_columns(schema),
            },
            observe: ObserveState::new(observe_op),
            attachments: AttachmentsState::default(),
            recent_revision: 0,
        }
    }

    #[inline]
    pub fn get_id(&self) -> Uuid {
        self.session_info.id
    }

    #[inline]
    pub fn get_info(&self) -> &SessionInfo {
        &self.session_info
    }

    pub fn drop_search(&mut self) {
        self.search.drop_search();
        self.signals.push(SessionSignal::SearchDropped);
    }

    pub fn add_operation(&mut self, observe_op: ObserveOperation) {
        self.observe.add_operation(observe_op);
        self.session_info.update_title(&self.observe);
    }

    /// Routes an operation phase update to the corresponding session state.
    pub fn update_operation(
        &mut self,
        operation_id: Uuid,
        phase: OperationPhase,
    ) -> UpdateOperationOutcome {
        // Ensure to update this method when new fields are added.
        let Self {
            session_info: _,
            signals: _,
            bottom_tab: _,
            side_tab: _,
            filters: _,
            search,
            search_values,
            logs: _,
            layout: _,
            observe,
            attachments: _,
            recent_revision: _,
        } = self;

        if observe.update_operation(operation_id, phase).consumed() {
            return UpdateOperationOutcome::Consumed;
        }

        if search.update_operation(operation_id, phase).consumed() {
            return UpdateOperationOutcome::Consumed;
        }

        search_values.update_operation(operation_id, phase)
    }

    /// Synchronizes UI state with backend search pipelines and returns the commands to dispatch.
    ///
    /// `target` selects which pipeline to sync:
    /// - `Filter`: logs search results pipeline (table/search results).
    /// - `SearchValue`: numeric search-values pipeline (charts only).
    /// - `Both`: use when one UI action affects both sets at once.
    pub fn sync_search_pipelines(
        &mut self,
        registry: &FilterRegistry,
        target: SearchSyncTarget,
    ) -> Vec<SessionCommand> {
        match target {
            SearchSyncTarget::Filter => self.sync_filter_search_pipeline(registry),
            SearchSyncTarget::SearchValue => self.sync_search_values_pipeline(registry),
            SearchSyncTarget::Both => {
                let mut commands = self.sync_filter_search_pipeline(registry);
                commands.extend(self.sync_search_values_pipeline(registry));
                commands
            }
        }
    }

    /// Synchronizes the logs search pipeline from current applied filters.
    ///
    /// When filters become empty we only drop the active search, otherwise we issue a
    /// drop-then-apply sequence so a running search does not keep the holder in use.
    fn sync_filter_search_pipeline(&mut self, registry: &FilterRegistry) -> Vec<SessionCommand> {
        let filters = self.search.get_active_filters(&self.filters, registry);
        if filters.is_empty() {
            let operation_id = self.search.processing_search_operation();
            self.search.clear_compiled_filters();
            self.drop_search();
            vec![SessionCommand::DropSearch { operation_id }]
        } else {
            let mut commands = Vec::with_capacity(2);
            if let Some(operation_id) = self.search.processing_search_operation() {
                commands.push(SessionCommand::DropSearch {
                    operation_id: Some(operation_id),
                });
            }
            self.drop_search();
            self.search.refresh_compiled_filters(&filters);
            let operation_id = Uuid::new_v4();
            self.search.set_search_operation(operation_id);
            commands.push(SessionCommand::ApplySearchFilter {
                operation_id,
                filters,
            });
            commands
        }
    }

    /// Synchronizes the search-values pipeline used by charts.
    ///
    /// Search values are independent from logs search results, so they are synchronized through
    /// their own drop/apply command pair and operation tracking.
    fn sync_search_values_pipeline(&mut self, registry: &FilterRegistry) -> Vec<SessionCommand> {
        let filters: Vec<_> = self
            .filters
            .enabled_search_value_ids()
            .filter_map(|uuid| registry.get_search_value(uuid))
            .map(|def| def.filter.value.clone())
            .collect();

        if filters.is_empty() {
            let operation_id = self.search_values.processing_operation();
            self.search_values.drop_search_values();
            vec![SessionCommand::DropSearchValues { operation_id }]
        } else {
            let mut commands = Vec::with_capacity(2);
            if let Some(operation_id) = self.search_values.processing_operation() {
                commands.push(SessionCommand::DropSearchValues {
                    operation_id: Some(operation_id),
                });
            }

            self.search_values.drop_search_values();
            let operation_id = Uuid::new_v4();
            self.search_values.set_operation(operation_id);
            commands.push(SessionCommand::ApplySearchValuesFilter {
                operation_id,
                filters,
            });
            commands
        }
    }

    /// Bumps the revision used to detect recent-session snapshot changes.
    pub fn bump_recent_revision(&mut self) {
        self.recent_revision = self.recent_revision.wrapping_add(1);
    }

    /// Returns the current revision used for recent-session update polling.
    pub fn recent_revision(&self) -> u64 {
        self.recent_revision
    }

    /// Updates one applied filter enabled flag and tracks recent-session dirtiness.
    pub fn set_filter_enabled(&mut self, filter_id: &Uuid, enabled: bool) -> bool {
        let changed = self.filters.set_filter_enabled(filter_id, enabled);
        if changed {
            self.bump_recent_revision();
        }
        changed
    }

    /// Updates one applied search value enabled flag and tracks recent-session dirtiness.
    pub fn set_search_value_enabled(&mut self, value_id: &Uuid, enabled: bool) -> bool {
        let changed = self.filters.set_search_value_enabled(value_id, enabled);
        if changed {
            self.bump_recent_revision();
        }
        changed
    }

    /// Pins the active temporary search as a filter and tracks recent-session dirtiness.
    pub fn pin_temp_search(&mut self, registry: &mut FilterRegistry) -> bool {
        let changed = self.filters.pin_temp_search(registry);
        if changed {
            self.bump_recent_revision();
        }
        changed
    }

    /// Pins the active temporary search as a search value and tracks recent-session dirtiness.
    pub fn pin_temp_search_as_value(&mut self, registry: &mut FilterRegistry) -> bool {
        let changed = self.filters.pin_temp_search_as_value(registry);
        if changed {
            self.bump_recent_revision();
        }
        changed
    }

    /// Applies a filter to this session and tracks recent-session dirtiness.
    pub fn apply_filter(&mut self, registry: &mut FilterRegistry, filter_id: Uuid) -> bool {
        let changed = self.filters.apply_filter(registry, filter_id);
        if changed {
            self.bump_recent_revision();
        }
        changed
    }

    /// Applies a filter with an explicit enabled state and tracks recent-session dirtiness.
    pub fn apply_filter_with_state(
        &mut self,
        registry: &mut FilterRegistry,
        filter_id: Uuid,
        enabled: bool,
    ) -> bool {
        let changed = self
            .filters
            .apply_filter_with_state(registry, filter_id, enabled);
        if changed {
            self.bump_recent_revision();
        }
        changed
    }

    /// Removes a filter from this session and tracks recent-session dirtiness.
    pub fn unapply_filter(&mut self, registry: &mut FilterRegistry, filter_id: &Uuid) -> bool {
        let changed = self.filters.unapply_filter(registry, filter_id);
        if changed {
            self.bump_recent_revision();
        }
        changed
    }

    /// Rebinds an applied filter row to a new registry id and tracks recent-session dirtiness.
    pub fn rebind_filter(&mut self, current_id: &Uuid, next_id: Uuid) -> bool {
        let changed = self.filters.rebind_filter(current_id, next_id);
        if changed {
            self.bump_recent_revision();
        }
        changed
    }

    /// Applies a search value to this session and tracks recent-session dirtiness.
    pub fn apply_search_value(&mut self, registry: &mut FilterRegistry, value_id: Uuid) -> bool {
        let changed = self.filters.apply_search_value(registry, value_id);
        if changed {
            self.bump_recent_revision();
        }
        changed
    }

    /// Applies a search value with an explicit enabled state and tracks recent-session dirtiness.
    pub fn apply_search_value_with_state(
        &mut self,
        registry: &mut FilterRegistry,
        value_id: Uuid,
        enabled: bool,
    ) -> bool {
        let changed = self
            .filters
            .apply_search_value_with_state(registry, value_id, enabled);
        if changed {
            self.bump_recent_revision();
        }
        changed
    }

    /// Removes a search value from this session and tracks recent-session dirtiness.
    pub fn unapply_search_value(&mut self, registry: &mut FilterRegistry, value_id: &Uuid) -> bool {
        let changed = self.filters.unapply_search_value(registry, value_id);
        if changed {
            self.bump_recent_revision();
        }
        changed
    }

    /// Rebinds an applied search-value row to a new registry id and tracks recent-session dirtiness.
    pub fn rebind_search_value(&mut self, current_id: &Uuid, next_id: Uuid) -> bool {
        let changed = self.filters.rebind_search_value(current_id, next_id);
        if changed {
            self.bump_recent_revision();
        }
        changed
    }

    /// Inserts a bookmark row and tracks recent-session dirtiness.
    pub fn insert_bookmark(&mut self, row: u64) -> bool {
        let changed = self.logs.bookmarked_rows.insert(row);
        if changed {
            self.bump_recent_revision();
        }
        changed
    }

    /// Removes a bookmark row and tracks recent-session dirtiness.
    pub fn remove_bookmark(&mut self, row: u64) -> bool {
        let changed = self.logs.bookmarked_rows.remove(&row);
        if changed {
            self.bump_recent_revision();
        }
        changed
    }
}

#[cfg(test)]
mod tests {
    use std::path::PathBuf;

    use processor::search::filter::SearchFilter;
    use stypes::{FileFormat, ObserveOptions, ObserveOrigin, ParserType};

    use crate::{
        host::{
            common::parsers::ParserNames,
            ui::registry::filters::{FilterDefinition, SearchValueDefinition},
        },
        session::{command::SessionCommand, ui::definitions::schema},
    };

    use super::*;

    fn new_shared() -> SessionShared {
        let session_id = Uuid::new_v4();
        let origin = ObserveOrigin::File(
            "source".to_owned(),
            FileFormat::Text,
            PathBuf::from("source.log"),
        );
        let observe_op = ObserveOperation::new(Uuid::new_v4(), origin);
        let session_info = SessionInfo {
            id: session_id,
            title: "test".to_owned(),
            parser: ParserNames::Text,
        };

        let schema = schema::from_parser(session_info.parser);
        SessionShared::new(session_info, observe_op, schema.as_ref())
    }

    fn new_shared_with_info_from_origin(origin: ObserveOrigin) -> SessionShared {
        let session_id = Uuid::new_v4();
        let observe_op = ObserveOperation::new(Uuid::new_v4(), origin.clone());
        let session_info = SessionInfo::from_observe_options(
            session_id,
            &ObserveOptions {
                origin,
                parser: ParserType::Text(()),
            },
        );

        let schema = schema::from_parser(session_info.parser);
        SessionShared::new(session_info, observe_op, schema.as_ref())
    }

    fn add_filter(shared: &mut SessionShared, registry: &mut FilterRegistry, value: &str) {
        let filter_def = FilterDefinition::new(SearchFilter::plain(value).ignore_case(true));
        let filter_id = filter_def.id;
        registry.add_filter(filter_def);
        shared.filters.apply_filter(registry, filter_id);
    }

    fn add_filter_def(
        shared: &mut SessionShared,
        registry: &mut FilterRegistry,
        filter: SearchFilter,
    ) -> Uuid {
        let filter_def = FilterDefinition::new(filter);
        let filter_id = filter_def.id;
        registry.add_filter(filter_def);
        shared.filters.apply_filter(registry, filter_id);
        filter_id
    }

    fn add_value(shared: &mut SessionShared, registry: &mut FilterRegistry, value: &str) {
        let value_def =
            SearchValueDefinition::new(SearchFilter::plain(value).regex(true).ignore_case(true));
        let value_id = value_def.id;
        registry.add_search_value(value_def);
        shared.filters.apply_search_value(registry, value_id);
    }

    #[test]
    fn drop_search_updates_counts() {
        let mut shared = new_shared();
        shared.search.set_search_operation(Uuid::new_v4());
        shared.search.set_search_result_count(4);
        shared.search.set_indexed_result_count(9);

        shared.drop_search();

        assert_eq!(shared.search.search_result_count(), 0);
        assert_eq!(shared.search.indexed_result_count(), 5);
        assert!(shared.search.current_matches_map().is_none());
        assert!(shared.search.search_operation_phase().is_none());
        assert_eq!(shared.signals, vec![SessionSignal::SearchDropped]);
    }

    #[test]
    fn append_updates_single_file_title_to_concat() {
        let mut shared = new_shared_with_info_from_origin(ObserveOrigin::File(
            "source".to_owned(),
            FileFormat::Text,
            PathBuf::from("source.log"),
        ));

        shared.add_operation(ObserveOperation::new(
            Uuid::new_v4(),
            ObserveOrigin::Concat(vec![(
                "second".to_owned(),
                FileFormat::Text,
                PathBuf::from("second.log"),
            )]),
        ));

        assert_eq!(shared.get_info().title, "Concating 2 files");
    }

    #[test]
    fn filter_sync_drops_search() {
        let mut shared = new_shared();
        let mut registry = FilterRegistry::default();
        add_filter(&mut shared, &mut registry, "status=ok");
        let _ = shared.sync_search_pipelines(&registry, SearchSyncTarget::Filter);
        assert_eq!(shared.search.compiled_filters().len(), 1);
        shared.filters.clear_temp_search();
        let filter_id = shared.filters.filter_entries[0].id;
        shared.filters.unapply_filter(&mut registry, &filter_id);
        let previous_operation_id = Uuid::new_v4();
        // An empty filter set should only tear down the active search operation.
        shared.search.set_search_operation(previous_operation_id);

        let commands = shared.sync_search_pipelines(&registry, SearchSyncTarget::Filter);

        assert_eq!(commands.len(), 1);
        match &commands[0] {
            SessionCommand::DropSearch { operation_id } => {
                assert_eq!(*operation_id, Some(previous_operation_id));
            }
            other => panic!("expected DropSearch command, got {other:?}"),
        }
        assert!(shared.search.compiled_filters().is_empty());
        assert!(shared.search.processing_search_operation().is_none());
    }

    #[test]
    fn filter_sync_reapplies() {
        let mut shared = new_shared();
        let mut registry = FilterRegistry::default();
        add_filter(&mut shared, &mut registry, "status=ok");

        let previous_operation_id = Uuid::new_v4();
        // Non-empty filter sync keeps the drop-before-apply contract.
        shared.search.set_search_operation(previous_operation_id);

        let commands = shared.sync_search_pipelines(&registry, SearchSyncTarget::Filter);

        assert_eq!(commands.len(), 2);
        match &commands[0] {
            SessionCommand::DropSearch { operation_id } => {
                assert_eq!(*operation_id, Some(previous_operation_id));
            }
            other => panic!("expected first command DropSearch, got {other:?}"),
        }

        let applied_operation_id = match &commands[1] {
            SessionCommand::ApplySearchFilter {
                operation_id,
                filters,
            } => {
                assert_eq!(filters.len(), 1);
                assert_eq!(filters[0].value, "status=ok");
                *operation_id
            }
            other => panic!("expected second command ApplySearchFilter, got {other:?}"),
        };

        assert_eq!(shared.search.compiled_filters().len(), 1);
        assert!(shared.search.compiled_filters()[0].is_match("status=ok"));
        assert_eq!(
            shared.search.processing_search_operation(),
            Some(applied_operation_id)
        );
    }

    #[test]
    fn filter_sync_applies_temp() {
        let mut shared = new_shared();
        let registry = FilterRegistry::default();
        shared
            .filters
            .set_temp_search(SearchFilter::plain("temp").ignore_case(true));

        let commands = shared.sync_search_pipelines(&registry, SearchSyncTarget::Filter);

        assert_eq!(commands.len(), 1);
        match &commands[0] {
            SessionCommand::ApplySearchFilter { filters, .. } => {
                assert_eq!(filters.len(), 1);
                assert_eq!(filters[0].value, "temp");
            }
            other => panic!("expected ApplySearchFilter, got {other:?}"),
        }
        assert_eq!(shared.search.compiled_filters().len(), 1);
        assert!(shared.search.compiled_filters()[0].is_match("TEMP"));
    }

    #[test]
    fn filter_sync_cache_matches_apply_payload() {
        let mut shared = new_shared();
        let mut registry = FilterRegistry::default();
        add_filter_def(&mut shared, &mut registry, SearchFilter::plain("status=ok"));
        add_filter_def(
            &mut shared,
            &mut registry,
            SearchFilter::plain("cpu=\\d+").regex(true).word(true),
        );
        add_filter_def(
            &mut shared,
            &mut registry,
            SearchFilter::plain("warning").ignore_case(true),
        );
        shared
            .filters
            .set_temp_search(SearchFilter::plain("temp").ignore_case(true));

        let commands = shared.sync_search_pipelines(&registry, SearchSyncTarget::Filter);

        let payload_filters = match &commands[0] {
            SessionCommand::ApplySearchFilter { filters, .. } => filters,
            other => panic!("expected ApplySearchFilter, got {other:?}"),
        };

        let compiled = shared.search.compiled_filters();
        assert_eq!(compiled.len(), payload_filters.len());
        assert_eq!(payload_filters.len(), 4);

        assert!(compiled[0].is_match("status=ok"));
        assert!(!compiled[0].is_match("STATUS=OK"));

        assert!(compiled[1].is_match("cpu=42"));
        assert!(!compiled[1].is_match("cpu=42x"));

        assert!(compiled[2].is_match("WARNING"));
        assert!(!compiled[2].is_match("WARN"));

        assert!(compiled[3].is_match("TEMP"));
        assert!(!compiled[3].is_match("TEAM"));
    }

    #[test]
    fn filter_sync_cache_updates_after_edit() {
        let mut shared = new_shared();
        let mut registry = FilterRegistry::default();
        let filter_id =
            add_filter_def(&mut shared, &mut registry, SearchFilter::plain("status=ok"));

        let initial_commands = shared.sync_search_pipelines(&registry, SearchSyncTarget::Filter);
        assert!(matches!(
            initial_commands[0],
            SessionCommand::ApplySearchFilter { .. }
        ));
        assert_eq!(shared.search.compiled_filters().len(), 1);
        assert!(shared.search.compiled_filters()[0].is_match("status=ok"));
        assert!(!shared.search.compiled_filters()[0].is_match("level=warn"));

        let next_filter = SearchFilter::plain("level=warn");
        let outcome = registry.edit_filter_for_session(filter_id, shared.get_id(), next_filter);
        assert!(matches!(
            outcome,
            crate::host::ui::registry::filters::RegistryEditOutcome::EditedInPlace
        ));

        let updated_commands = shared.sync_search_pipelines(&registry, SearchSyncTarget::Filter);
        let payload_filters = match &updated_commands[1] {
            SessionCommand::ApplySearchFilter { filters, .. } => filters,
            other => panic!("expected ApplySearchFilter, got {other:?}"),
        };

        assert_eq!(payload_filters.len(), 1);
        assert_eq!(payload_filters[0].value, "level=warn");
        assert_eq!(shared.search.compiled_filters().len(), 1);
        assert!(shared.search.compiled_filters()[0].is_match("level=warn"));
        assert!(!shared.search.compiled_filters()[0].is_match("status=ok"));
    }

    #[test]
    fn values_sync_drops() {
        let mut shared = new_shared();
        let registry = FilterRegistry::default();
        let previous_operation_id = Uuid::new_v4();
        // Search values use the same drop-only behavior when nothing stays enabled.
        shared.search_values.set_operation(previous_operation_id);

        let commands = shared.sync_search_pipelines(&registry, SearchSyncTarget::SearchValue);

        assert_eq!(commands.len(), 1);
        match &commands[0] {
            SessionCommand::DropSearchValues { operation_id } => {
                assert_eq!(*operation_id, Some(previous_operation_id));
            }
            other => panic!("expected DropSearchValues command, got {other:?}"),
        }
        assert!(shared.search_values.processing_operation().is_none());
    }

    #[test]
    fn values_sync_reapplies() {
        let mut shared = new_shared();
        let mut registry = FilterRegistry::default();
        add_value(&mut shared, &mut registry, "cpu=(\\d+)");
        let previous_operation_id = Uuid::new_v4();
        // Search-value sync also reissues its backend operation after dropping the old one.
        shared.search_values.set_operation(previous_operation_id);

        let commands = shared.sync_search_pipelines(&registry, SearchSyncTarget::SearchValue);

        assert_eq!(commands.len(), 2);
        match &commands[0] {
            SessionCommand::DropSearchValues { operation_id } => {
                assert_eq!(*operation_id, Some(previous_operation_id));
            }
            other => panic!("expected first command DropSearchValues, got {other:?}"),
        }

        let applied_operation_id = match &commands[1] {
            SessionCommand::ApplySearchValuesFilter {
                operation_id,
                filters,
            } => {
                assert_eq!(filters, &vec!["cpu=(\\d+)".to_owned()]);
                *operation_id
            }
            other => panic!("expected second command ApplySearchValuesFilter, got {other:?}"),
        };

        assert_eq!(
            shared.search_values.processing_operation(),
            Some(applied_operation_id)
        );
    }

    #[test]
    fn filter_sync_skips_disabled() {
        let mut shared = new_shared();
        let mut registry = FilterRegistry::default();
        add_filter(&mut shared, &mut registry, "status=ok");
        let filter_id = shared.filters.filter_entries[0].id;
        let _ = shared.sync_search_pipelines(&registry, SearchSyncTarget::Filter);
        assert_eq!(shared.search.compiled_filters().len(), 1);
        // Disabled filters stay in session state but should not reach backend sync.
        assert!(shared.filters.set_filter_enabled(&filter_id, false));

        let commands = shared.sync_search_pipelines(&registry, SearchSyncTarget::Filter);

        assert_eq!(commands.len(), 1);
        assert!(matches!(commands[0], SessionCommand::DropSearch { .. }));
        assert!(shared.search.compiled_filters().is_empty());
    }

    #[test]
    fn values_sync_skips_disabled() {
        let mut shared = new_shared();
        let mut registry = FilterRegistry::default();
        add_value(&mut shared, &mut registry, "cpu=(\\d+)");
        let value_id = shared.filters.search_value_entries[0].id;
        // Disabled search values should be treated as absent by the chart pipeline.
        assert!(shared.filters.set_search_value_enabled(&value_id, false));

        let commands = shared.sync_search_pipelines(&registry, SearchSyncTarget::SearchValue);

        assert_eq!(commands.len(), 1);
        assert!(matches!(
            commands[0],
            SessionCommand::DropSearchValues { .. }
        ));
    }

    #[test]
    fn both_sync_orders_filters_first() {
        let mut shared = new_shared();
        let mut registry = FilterRegistry::default();
        add_filter(&mut shared, &mut registry, "level=warn");
        add_value(&mut shared, &mut registry, "temp=(\\d+)");

        shared.search.set_search_operation(Uuid::new_v4());
        shared.search_values.set_operation(Uuid::new_v4());

        let commands = shared.sync_search_pipelines(&registry, SearchSyncTarget::Both);

        assert_eq!(commands.len(), 4);
        assert!(matches!(commands[0], SessionCommand::DropSearch { .. }));
        assert!(matches!(
            commands[1],
            SessionCommand::ApplySearchFilter { .. }
        ));
        assert!(matches!(
            commands[2],
            SessionCommand::DropSearchValues { .. }
        ));
        assert!(matches!(
            commands[3],
            SessionCommand::ApplySearchValuesFilter { .. }
        ));
    }
}
