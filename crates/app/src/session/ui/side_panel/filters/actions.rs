//! Deferred Filters sidebar actions and session state updates.

use uuid::Uuid;

use crate::{
    common::validation::{ValidationEligibility, validate_filter},
    host::ui::{
        UiActions,
        registry::filters::{FilterRegistry, RegistryEditOutcome},
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
