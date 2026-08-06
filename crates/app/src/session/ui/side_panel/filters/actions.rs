//! Deferred Filters sidebar actions and session state updates.

use uuid::Uuid;

use crate::{
    common::validation::{ValidationEligibility, validate_filter},
    host::{
        notification::AppNotification,
        ui::{
            UiActions,
            registry::filters::{FilterRegistry, RegistryEditOutcome},
        },
    },
    session::ui::shared::{SearchSyncTarget, SessionShared, SessionSignal},
};

use super::render::validate_search_value_text;
use super::{FilterFlags, FiltersUi, SelectedSidebarItem, TextEditState};

/// Pending action selected from the Filters side panel.
///
/// Actions defer state changes until list iteration is complete.
#[derive(Debug, Clone)]
pub(super) enum FilterPanelAction {
    StartFilterEdit(Uuid),
    ApplyFilterText(Uuid, String),
    CancelFilterEdit(Uuid),
    StartSearchValueEdit(Uuid),
    ApplySearchValueText(Uuid, String),
    CancelSearchValueEdit(Uuid),
    ApplyTempSearch(SelectedSidebarItem),
    ToggleFilter(Uuid, bool),
    EditFilterFlags(Uuid, FilterFlags),
    RemoveFilter(Uuid),
    RemoveAllFilters,
    ReorderItem(SelectedSidebarItem, usize),
    /// Converts the filter and optionally places it at an exact insertion slot.
    MoveFilterToValue(Uuid, Option<usize>),
    ToggleSearchValue(Uuid, bool),
    RemoveSearchValue(Uuid),
    RemoveAllSearchValues,
    /// Converts the search value and optionally places it at an exact insertion slot.
    MoveValueToFilter(Uuid, Option<usize>),
    /// Requests the parent session to capture the current filters and charts.
    CapturePreset,
}

impl FiltersUi {
    /// Applies the queued sidebar mutation and dispatches any required pipeline sync commands.
    pub(super) fn handle_action(
        &mut self,
        side_action: Option<FilterPanelAction>,
        shared: &mut SessionShared,
        actions: &mut UiActions,
        registry: &mut FilterRegistry,
    ) {
        let Some(side_action) = side_action else {
            return;
        };
        // Apply the queued row mutation after rendering so we don't mutate the
        // session/registry state while iterating it to build the current UI frame.
        match side_action {
            FilterPanelAction::StartFilterEdit(filter_id) => {
                let Some(filter_def) = registry.get_filter(&filter_id) else {
                    return;
                };

                self.selected_item = Some(SelectedSidebarItem::Filter(filter_id));
                self.search_value_edit_state = None;
                let mut edit_state = TextEditState::new(filter_id, filter_def.filter.value.clone());
                edit_state.err_msg = match validate_filter(&filter_def.filter) {
                    ValidationEligibility::Eligible => None,
                    ValidationEligibility::Ineligible { reason } => Some(reason),
                };
                self.filter_edit_state = Some(edit_state);
            }
            FilterPanelAction::ApplyFilterText(filter_id, draft) => {
                let Some(current_filter) = registry.get_filter(&filter_id) else {
                    self.clear_filter_edit_for(filter_id);
                    return;
                };

                let mut next_filter = current_filter.filter.clone();
                next_filter.value = draft;

                match registry.edit_filter_for_session(filter_id, shared.get_id(), next_filter) {
                    RegistryEditOutcome::NotFound => {
                        self.clear_filter_edit_for(filter_id);
                    }
                    RegistryEditOutcome::EditedInPlace => {
                        self.clear_filter_edit_for(filter_id);
                        shared.bump_recent_revision();
                        self.dispatch_sync_commands(
                            shared,
                            actions,
                            registry,
                            SearchSyncTarget::Filter,
                        );
                    }
                    RegistryEditOutcome::Reassigned(next_filter_id) => {
                        if shared.rebind_filter(&filter_id, next_filter_id) {
                            self.replace_selection(
                                SelectedSidebarItem::Filter(filter_id),
                                SelectedSidebarItem::Filter(next_filter_id),
                            );
                        }
                        self.clear_filter_edit_for(filter_id);
                        self.dispatch_sync_commands(
                            shared,
                            actions,
                            registry,
                            SearchSyncTarget::Filter,
                        );
                    }
                }
            }
            FilterPanelAction::CancelFilterEdit(filter_id) => {
                self.clear_filter_edit_for(filter_id);
            }
            FilterPanelAction::StartSearchValueEdit(value_id) => {
                let Some(value_def) = registry.get_search_value(&value_id) else {
                    return;
                };

                self.selected_item = Some(SelectedSidebarItem::SearchValue(value_id));
                self.filter_edit_state = None;
                let mut edit_state = TextEditState::new(value_id, value_def.filter.value.clone());
                edit_state.err_msg =
                    validate_search_value_text(&value_def.filter, &edit_state.draft);
                self.search_value_edit_state = Some(edit_state);
            }
            FilterPanelAction::ApplySearchValueText(value_id, draft) => {
                let Some(current_value) = registry.get_search_value(&value_id) else {
                    self.clear_search_value_edit_for(value_id);
                    return;
                };

                let mut next_filter = current_value.filter.clone();
                next_filter.value = draft;

                match registry.edit_search_value_for_session(value_id, shared.get_id(), next_filter)
                {
                    RegistryEditOutcome::NotFound => {
                        self.clear_search_value_edit_for(value_id);
                    }
                    RegistryEditOutcome::EditedInPlace => {
                        self.clear_search_value_edit_for(value_id);
                        shared.bump_recent_revision();
                        self.dispatch_sync_commands(
                            shared,
                            actions,
                            registry,
                            SearchSyncTarget::SearchValue,
                        );
                    }
                    RegistryEditOutcome::Reassigned(next_value_id) => {
                        if shared.rebind_search_value(&value_id, next_value_id) {
                            self.replace_selection(
                                SelectedSidebarItem::SearchValue(value_id),
                                SelectedSidebarItem::SearchValue(next_value_id),
                            );
                        }
                        self.clear_search_value_edit_for(value_id);
                        self.dispatch_sync_commands(
                            shared,
                            actions,
                            registry,
                            SearchSyncTarget::SearchValue,
                        );
                    }
                }
            }
            FilterPanelAction::CancelSearchValueEdit(value_id) => {
                self.clear_search_value_edit_for(value_id);
            }
            FilterPanelAction::ApplyTempSearch(item) => {
                let filter = match item {
                    SelectedSidebarItem::Filter(filter_id) => {
                        let Some(definition) = registry.get_filter(&filter_id) else {
                            return;
                        };
                        definition.filter.clone()
                    }
                    SelectedSidebarItem::SearchValue(value_id) => {
                        let Some(definition) = registry.get_search_value(&value_id) else {
                            return;
                        };
                        definition.filter.clone()
                    }
                };

                match validate_filter(&filter) {
                    ValidationEligibility::Eligible => {
                        let temp_search = filter.clone().into();
                        shared.filters.active_temp_search = Some(temp_search);
                        shared
                            .sync_search(registry, SearchSyncTarget::Filter)
                            .into_iter()
                            .for_each(|cmd| _ = actions.try_send_command(&self.cmd_tx, cmd));
                        shared
                            .signals
                            .push(SessionSignal::TempSearchApplied(filter));
                    }
                    ValidationEligibility::Ineligible { reason } => {
                        let message = format!("Filter couldn't be applied: {reason}");
                        actions.add_notification(AppNotification::Warning(message));
                    }
                }
            }
            FilterPanelAction::ToggleFilter(filter_id, enabled) => {
                if shared.set_filter_enabled(&filter_id, enabled) {
                    self.dispatch_sync_commands(
                        shared,
                        actions,
                        registry,
                        SearchSyncTarget::Filter,
                    );
                }
            }
            FilterPanelAction::EditFilterFlags(filter_id, flags) => {
                let Some(current_filter) = registry.get_filter(&filter_id) else {
                    return;
                };

                let FilterFlags {
                    regex,
                    ignore_case,
                    word,
                } = flags;
                let next_filter = current_filter
                    .filter
                    .clone()
                    .regex(regex)
                    .ignore_case(ignore_case)
                    .word(word);

                match validate_filter(&next_filter) {
                    ValidationEligibility::Eligible => (),
                    ValidationEligibility::Ineligible { reason } => {
                        log::warn!(
                            "EditFilterFlags produced invalid filter {filter_id} in session {}: {reason}",
                            shared.get_id()
                        );
                        return;
                    }
                }

                match registry.edit_filter_for_session(filter_id, shared.get_id(), next_filter) {
                    RegistryEditOutcome::NotFound => {}
                    RegistryEditOutcome::EditedInPlace => {
                        shared.bump_recent_revision();
                        self.dispatch_sync_commands(
                            shared,
                            actions,
                            registry,
                            SearchSyncTarget::Filter,
                        );
                    }
                    RegistryEditOutcome::Reassigned(next_filter_id) => {
                        if shared.rebind_filter(&filter_id, next_filter_id) {
                            self.replace_selection(
                                SelectedSidebarItem::Filter(filter_id),
                                SelectedSidebarItem::Filter(next_filter_id),
                            );
                        }

                        self.dispatch_sync_commands(
                            shared,
                            actions,
                            registry,
                            SearchSyncTarget::Filter,
                        );
                    }
                }
            }
            FilterPanelAction::RemoveFilter(filter_id) => {
                self.clear_filter_edit_for(filter_id);
                self.clear_selection_for(SelectedSidebarItem::Filter(filter_id));
                shared.unapply_filter(registry, &filter_id);
                self.dispatch_sync_commands(shared, actions, registry, SearchSyncTarget::Filter);
            }
            FilterPanelAction::RemoveAllFilters => {
                self.filter_edit_state = None;
                if self
                    .selected_item
                    .is_some_and(|item| matches!(item, SelectedSidebarItem::Filter(_)))
                {
                    self.selected_item = None;
                }
                shared.unapply_all_filters(registry);
                self.dispatch_sync_commands(shared, actions, registry, SearchSyncTarget::Filter);
            }
            FilterPanelAction::ReorderItem(item, insert_index) => {
                let (changed, target) = match item {
                    SelectedSidebarItem::Filter(filter_id) => (
                        shared.move_filter(&filter_id, insert_index),
                        SearchSyncTarget::Filter,
                    ),
                    SelectedSidebarItem::SearchValue(value_id) => (
                        shared.move_search_value(&value_id, insert_index),
                        SearchSyncTarget::SearchValue,
                    ),
                };
                // Backend result metadata uses positional indexes, so reorders currently resync.
                if changed {
                    self.dispatch_sync_commands(shared, actions, registry, target);
                }
            }
            FilterPanelAction::MoveFilterToValue(filter_id, insert_index) => {
                self.clear_filter_edit_for(filter_id);
                let was_applied = shared.filters.is_filter_applied(&filter_id);
                let was_enabled = shared.filters.is_filter_enabled(&filter_id);
                let session_id = shared.get_id();
                let converted_value = registry.convert_filter_to_value(filter_id, session_id);
                if let Some(value_id) = converted_value
                    && was_applied
                {
                    shared.unapply_filter(registry, &filter_id);
                    shared.apply_search_value_with_state(registry, value_id, was_enabled, None);
                    if let Some(insert_index) = insert_index {
                        shared.move_search_value(&value_id, insert_index);
                    }
                    self.replace_selection(
                        SelectedSidebarItem::Filter(filter_id),
                        SelectedSidebarItem::SearchValue(value_id),
                    );
                    self.dispatch_sync_commands(shared, actions, registry, SearchSyncTarget::Both);
                }
            }
            FilterPanelAction::ToggleSearchValue(value_id, enabled) => {
                if shared.set_search_value_enabled(&value_id, enabled) {
                    self.dispatch_sync_commands(
                        shared,
                        actions,
                        registry,
                        SearchSyncTarget::SearchValue,
                    );
                }
            }
            FilterPanelAction::RemoveSearchValue(value_id) => {
                self.clear_search_value_edit_for(value_id);
                self.clear_selection_for(SelectedSidebarItem::SearchValue(value_id));
                shared.unapply_search_value(registry, &value_id);
                self.dispatch_sync_commands(
                    shared,
                    actions,
                    registry,
                    SearchSyncTarget::SearchValue,
                );
            }
            FilterPanelAction::RemoveAllSearchValues => {
                self.search_value_edit_state = None;
                if self
                    .selected_item
                    .is_some_and(|item| matches!(item, SelectedSidebarItem::SearchValue(_)))
                {
                    self.selected_item = None;
                }
                shared.unapply_all_search_values(registry);
                self.dispatch_sync_commands(
                    shared,
                    actions,
                    registry,
                    SearchSyncTarget::SearchValue,
                );
            }
            FilterPanelAction::MoveValueToFilter(value_id, insert_index) => {
                self.clear_search_value_edit_for(value_id);
                let was_applied = shared.filters.is_search_value_applied(&value_id);
                let was_enabled = shared.filters.is_search_value_enabled(&value_id);
                let session_id = shared.get_id();
                let converted_filter = registry.convert_value_to_filter(value_id, session_id);
                if let Some(filter_id) = converted_filter
                    && was_applied
                {
                    shared.unapply_search_value(registry, &value_id);
                    shared.apply_filter_with_state(registry, filter_id, was_enabled, None);
                    if let Some(insert_index) = insert_index {
                        shared.move_filter(&filter_id, insert_index);
                    }
                    self.replace_selection(
                        SelectedSidebarItem::SearchValue(value_id),
                        SelectedSidebarItem::Filter(filter_id),
                    );
                    self.dispatch_sync_commands(shared, actions, registry, SearchSyncTarget::Both);
                }
            }
            FilterPanelAction::CapturePreset => {
                shared.signals.push(SessionSignal::CapturePreset);
            }
        }
    }

    fn dispatch_sync_commands(
        &self,
        shared: &mut SessionShared,
        actions: &mut UiActions,
        registry: &FilterRegistry,
        target: SearchSyncTarget,
    ) {
        shared
            .sync_persistent_search(registry, target)
            .into_iter()
            .for_each(|cmd| _ = actions.try_send_command(&self.cmd_tx, cmd));
    }
}

#[cfg(test)]
mod tests {
    use std::path::PathBuf;

    use processor::search::filter::SearchFilter;
    use stypes::{FileFormat, ObserveOrigin};
    use tokio::{runtime::Runtime, sync::mpsc};
    use uuid::Uuid;

    use crate::{
        host::{
            common::parsers::ParserNames,
            notification::AppNotification,
            ui::{
                UiActions,
                registry::filters::{FilterDefinition, FilterRegistry, SearchValueDefinition},
            },
        },
        session::{
            command::SessionCommand,
            types::ObserveOperation,
            ui::{SessionInfo, definitions::schema::LogSchemaSpec, shared::SessionShared},
        },
    };

    use super::{FilterPanelAction, FiltersUi, SelectedSidebarItem};

    fn new_shared() -> SessionShared {
        let session_info = SessionInfo {
            id: Uuid::new_v4(),
            title: "test".to_owned(),
            parser: ParserNames::Text,
            raw_export_supported: false,
        };
        let observe_op = ObserveOperation::new(
            Uuid::new_v4(),
            ObserveOrigin::File(
                "source".to_owned(),
                FileFormat::Text,
                PathBuf::from("source.log"),
            ),
        );

        SessionShared::new(session_info, observe_op, LogSchemaSpec::Text)
    }

    #[test]
    fn copied_filter_replaces_temp_search_with_flags() {
        let runtime = Runtime::new().expect("runtime should initialize");
        let mut actions = UiActions::new(runtime.handle().clone());
        let mut registry = FilterRegistry::default();
        let mut shared = new_shared();
        shared.filters.active_temp_search = Some(SearchFilter::plain("old").into());
        let copied_filter = SearchFilter::plain("status=(ok|warn)")
            .regex(true)
            .ignore_case(true)
            .word(true);
        let value_id = registry.add_search_value(SearchValueDefinition::new(copied_filter.clone()));
        let (cmd_tx, mut cmd_rx) = mpsc::channel(4);
        let mut filters_ui = FiltersUi::new(cmd_tx);

        filters_ui.handle_action(
            Some(FilterPanelAction::ApplyTempSearch(
                SelectedSidebarItem::SearchValue(value_id),
            )),
            &mut shared,
            &mut actions,
            &mut registry,
        );

        assert_eq!(
            shared
                .filters
                .active_temp_search
                .as_ref()
                .map(|temp| temp.filter()),
            Some(&copied_filter)
        );
        match cmd_rx.try_recv() {
            Ok(SessionCommand::ApplySearchFilter { filters, .. }) => {
                assert_eq!(filters, vec![copied_filter.clone()]);
            }
            other => panic!("expected ApplySearchFilter command, got {other:?}"),
        }
    }

    #[test]
    fn invalid_copied_filter_preserves_temp_search() {
        let runtime = Runtime::new().expect("runtime should initialize");
        let mut actions = UiActions::new(runtime.handle().clone());
        let mut registry = FilterRegistry::default();
        let mut shared = new_shared();
        let current_filter = SearchFilter::plain("current").ignore_case(true);
        shared.filters.active_temp_search = Some(current_filter.clone().into());
        let invalid_filter = SearchFilter::plain("(").regex(true);
        let filter_id = registry.add_filter(FilterDefinition::new(invalid_filter));
        let (cmd_tx, mut cmd_rx) = mpsc::channel(1);
        let mut filters_ui = FiltersUi::new(cmd_tx);

        filters_ui.handle_action(
            Some(FilterPanelAction::ApplyTempSearch(
                SelectedSidebarItem::Filter(filter_id),
            )),
            &mut shared,
            &mut actions,
            &mut registry,
        );

        assert_eq!(
            shared
                .filters
                .active_temp_search
                .as_ref()
                .map(|temp| temp.filter()),
            Some(&current_filter)
        );
        assert!(cmd_rx.try_recv().is_err());
        assert!(matches!(
            actions.drain_notifications().next(),
            Some(AppNotification::Warning(_))
        ));
        assert!(shared.signals.is_empty());
    }
}
