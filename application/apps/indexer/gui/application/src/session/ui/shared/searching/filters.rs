//! Session-local state for the user-selected search inputs.
//!
//! [`FiltersState`] bridges global registry definitions with per-session UI state.
//! It owns the ordered list of applied filters and search values, plus the temporary search from
//! the search bar before it is pinned into the registry.

use crate::common::search_value_validation::{
    SearchValueEligibility, validate_search_value_filter,
};
use crate::host::{
    common::colors,
    ui::registry::filters::{FilterDefinition, FilterRegistry, SearchValueDefinition},
};
use processor::search::filter::SearchFilter;
use uuid::Uuid;

/// Temporary search from the search bar with its cached eligibility.
#[derive(Debug, Clone)]
pub struct TempSearch {
    filter: SearchFilter,
    eligibility: SearchValueEligibility,
}

impl TempSearch {
    pub fn new(filter: SearchFilter) -> Self {
        let eligibility = validate_search_value_filter(&filter);
        Self {
            filter,
            eligibility,
        }
    }

    pub const fn filter(&self) -> &SearchFilter {
        &self.filter
    }

    pub const fn eligibility(&self) -> &SearchValueEligibility {
        &self.eligibility
    }

    pub fn into_filter(self) -> SearchFilter {
        self.filter
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
/// Session-local item state used by filters and search values.
pub struct AppliedItemState {
    pub id: Uuid,
    pub enabled: bool,
}

/// Maintains the ordered list of filters and search values applied
/// to a specific session.
#[derive(Debug, Clone)]
pub struct FiltersState {
    session_id: Uuid,
    pub filter_entries: Vec<AppliedItemState>,
    pub search_value_entries: Vec<AppliedItemState>,
    pub active_temp_search: Option<TempSearch>,
}

impl FiltersState {
    pub fn new(session_id: Uuid) -> Self {
        Self {
            session_id,
            filter_entries: Vec::new(),
            search_value_entries: Vec::new(),
            active_temp_search: None,
        }
    }

    pub fn set_temp_search(&mut self, filter: SearchFilter) {
        self.active_temp_search = Some(TempSearch::new(filter));
    }

    pub fn clear_temp_search(&mut self) {
        self.active_temp_search = None;
    }

    pub fn take_temp_search(&mut self) -> Option<SearchFilter> {
        self.active_temp_search.take().map(TempSearch::into_filter)
    }

    /// Converts the current temporary search into a persistent filter.
    pub fn pin_temp_search(&mut self, registry: &mut FilterRegistry) {
        if let Some(filter) = self.take_temp_search() {
            let used_colors: Vec<_> = registry
                .filters_map()
                .values()
                .map(|def| def.colors.clone())
                .collect();
            let filter_def = FilterDefinition::new(filter, colors::next_filter_color(&used_colors));
            let filter_id = filter_def.id;
            registry.add_filter(filter_def);
            self.apply_filter(registry, filter_id);
        }
    }

    /// Converts the current temporary search into a global search value.
    /// The temporary search is consumed from the session state.
    pub fn pin_temp_search_as_value(&mut self, registry: &mut FilterRegistry) -> bool {
        if !self
            .active_temp_search
            .as_ref()
            .is_some_and(|temp| temp.eligibility().is_eligible())
        {
            return false;
        }

        if let Some(filter) = self.take_temp_search() {
            let used_colors: Vec<_> = registry
                .search_value_map()
                .values()
                .map(|value| value.color)
                .collect();
            let search_value_def =
                SearchValueDefinition::new(filter, colors::next_search_value_color(&used_colors));
            let search_value_id = search_value_def.id;
            registry.add_search_value(search_value_def);
            self.apply_search_value(registry, search_value_id);
            return true;
        }

        false
    }

    /// Returns whether the filter exists in this session,
    /// regardless of enabled state.
    pub fn is_filter_applied(&self, id: &Uuid) -> bool {
        self.filter_entries.iter().any(|item| item.id == *id)
    }

    /// Returns whether the search value exists in this session,
    /// regardless of enabled state.
    pub fn is_search_value_applied(&self, id: &Uuid) -> bool {
        self.search_value_entries.iter().any(|item| item.id == *id)
    }

    /// Returns whether the filter is currently active for sync and rendering.
    pub fn is_filter_enabled(&self, id: &Uuid) -> bool {
        self.filter_entries
            .iter()
            .find(|item| item.id == *id)
            .is_some_and(|item| item.enabled)
    }

    /// Returns whether the search value is currently active for sync and rendering.
    pub fn is_search_value_enabled(&self, id: &Uuid) -> bool {
        self.search_value_entries
            .iter()
            .find(|item| item.id == *id)
            .is_some_and(|item| item.enabled)
    }

    /// Iterates enabled filters in their session order.
    pub fn enabled_filter_ids(&self) -> impl Iterator<Item = &Uuid> {
        self.filter_entries
            .iter()
            .filter(|item| item.enabled)
            .map(|item| &item.id)
    }

    /// Iterates enabled search values in their session order.
    pub fn enabled_search_value_ids(&self) -> impl Iterator<Item = &Uuid> {
        self.search_value_entries
            .iter()
            .filter(|item| item.enabled)
            .map(|item| &item.id)
    }

    /// Adds the filter to the session or updates its enabled state in place.
    fn set_filter_entry(&mut self, registry: &mut FilterRegistry, id: Uuid, enabled: bool) {
        if let Some(item) = self.filter_entries.iter_mut().find(|item| item.id == id) {
            item.enabled = enabled;
            return;
        }

        self.filter_entries.push(AppliedItemState { id, enabled });
        registry.apply_filter_to_session(id, self.session_id);
    }

    /// Adds the search value to the session or updates its enabled state in place.
    fn set_search_value_entry(&mut self, registry: &mut FilterRegistry, id: Uuid, enabled: bool) {
        if let Some(item) = self
            .search_value_entries
            .iter_mut()
            .find(|item| item.id == id)
        {
            item.enabled = enabled;
            return;
        }

        self.search_value_entries
            .push(AppliedItemState { id, enabled });
        registry.apply_search_value_to_session(id, self.session_id);
    }

    /// Updates the enabled flag for an existing filter and reports
    /// whether it changed.
    pub fn set_filter_enabled(&mut self, id: &Uuid, enabled: bool) -> bool {
        if let Some(item) = self.filter_entries.iter_mut().find(|item| item.id == *id) {
            let changed = item.enabled != enabled;
            item.enabled = enabled;
            return changed;
        }

        false
    }

    /// Updates the enabled flag for an existing search value and reports
    /// whether it changed.
    pub fn set_search_value_enabled(&mut self, id: &Uuid, enabled: bool) -> bool {
        if let Some(item) = self
            .search_value_entries
            .iter_mut()
            .find(|item| item.id == *id)
        {
            let changed = item.enabled != enabled;
            item.enabled = enabled;
            return changed;
        }

        false
    }

    /// Adds a filter to the session in the enabled state.
    pub fn apply_filter(&mut self, registry: &mut FilterRegistry, id: Uuid) {
        self.set_filter_entry(registry, id, true);
    }

    /// Adds a filter to the session while preserving an explicit enabled state.
    pub fn apply_filter_with_state(
        &mut self,
        registry: &mut FilterRegistry,
        id: Uuid,
        enabled: bool,
    ) {
        self.set_filter_entry(registry, id, enabled);
    }

    /// Removes the filter from the session entirely.
    pub fn unapply_filter(&mut self, registry: &mut FilterRegistry, id: &Uuid) {
        if self.is_filter_applied(id) {
            self.filter_entries.retain(|item| item.id != *id);
            registry.unapply_filter_from_session(*id, self.session_id);
        }
    }

    /// Adds a search value to the session in the enabled state.
    pub fn apply_search_value(&mut self, registry: &mut FilterRegistry, id: Uuid) {
        self.set_search_value_entry(registry, id, true);
    }

    /// Adds a search value to the session while preserving an explicit enabled state.
    pub fn apply_search_value_with_state(
        &mut self,
        registry: &mut FilterRegistry,
        id: Uuid,
        enabled: bool,
    ) {
        self.set_search_value_entry(registry, id, enabled);
    }

    /// Removes the search value from the session entirely.
    pub fn unapply_search_value(&mut self, registry: &mut FilterRegistry, id: &Uuid) {
        if self.is_search_value_applied(id) {
            self.search_value_entries.retain(|item| item.id != *id);
            registry.unapply_search_value_from_session(*id, self.session_id);
        }
    }
}
