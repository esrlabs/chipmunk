//! Session-local state for the user-selected search inputs.
//!
//! [`FiltersState`] bridges global registry definitions with per-session UI state.
//! It owns the ordered list of applied filters and search values, plus the temporary search from
//! the search bar before it is pinned into the registry.

use egui::Color32;
use processor::search::filter::SearchFilter;
use uuid::Uuid;

use crate::common::validation::{
    ValidationEligibility, validate_filter, validate_search_value_filter,
};
use crate::host::{
    common::colors::{self, ColorPair},
    ui::registry::filters::{FilterDefinition, FilterRegistry, SearchValueDefinition},
};

/// Temporary search from the search bar with its cached eligibility.
#[derive(Debug, Clone)]
pub struct TempSearch {
    filter: SearchFilter,
    filter_eligibility: ValidationEligibility,
    search_value_eligibility: ValidationEligibility,
}

impl TempSearch {
    pub fn new(filter: SearchFilter) -> Self {
        let filter_eligibility = validate_filter(&filter);
        let search_value_eligibility = validate_search_value_filter(&filter);
        Self {
            filter,
            filter_eligibility,
            search_value_eligibility,
        }
    }

    pub const fn filter(&self) -> &SearchFilter {
        &self.filter
    }

    pub const fn filter_eligibility(&self) -> &ValidationEligibility {
        &self.filter_eligibility
    }

    pub const fn search_value_eligibility(&self) -> &ValidationEligibility {
        &self.search_value_eligibility
    }

    pub fn into_filter(self) -> SearchFilter {
        self.filter
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
/// Session-local state for one applied filter.
pub struct AppliedFilterState {
    pub id: Uuid,
    pub enabled: bool,
    pub colors: ColorPair,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
/// Session-local state for one applied chart/search value.
pub struct AppliedSearchValueState {
    pub id: Uuid,
    pub enabled: bool,
    pub color: Color32,
}

impl AppliedFilterState {
    fn new(id: Uuid, enabled: bool, colors: ColorPair) -> Self {
        Self {
            id,
            enabled,
            colors,
        }
    }
}

impl AppliedSearchValueState {
    fn new(id: Uuid, enabled: bool, color: Color32) -> Self {
        Self { id, enabled, color }
    }
}

/// Maintains the ordered list of filters and search values applied
/// to a specific session.
#[derive(Debug, Clone)]
pub struct FiltersState {
    session_id: Uuid,
    pub filter_entries: Vec<AppliedFilterState>,
    pub search_value_entries: Vec<AppliedSearchValueState>,
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
    pub fn pin_temp_search(&mut self, registry: &mut FilterRegistry) -> bool {
        if !self
            .active_temp_search
            .as_ref()
            .is_some_and(|temp| temp.filter_eligibility().is_eligible())
        {
            return false;
        }

        if let Some(filter) = self.take_temp_search() {
            let filter_id = registry.add_filter(FilterDefinition::new(filter));
            self.apply_filter(registry, filter_id);
            return true;
        }

        false
    }

    /// Converts the current temporary search into a global search value.
    /// The temporary search is consumed from the session state.
    pub fn pin_temp_search_as_value(&mut self, registry: &mut FilterRegistry) -> bool {
        if !self
            .active_temp_search
            .as_ref()
            .is_some_and(|temp| temp.search_value_eligibility().is_eligible())
        {
            return false;
        }

        if let Some(filter) = self.take_temp_search() {
            let search_value_id = registry.add_search_value(SearchValueDefinition::new(filter));
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

    /// Returns the next filter highlight pair available within this session.
    fn next_filter_color_pair(&self) -> ColorPair {
        let used_colors: Vec<_> = self
            .filter_entries
            .iter()
            .map(|item| item.colors.clone())
            .collect();
        colors::next_filter_color(&used_colors)
    }

    /// Returns the next chart color available within this session.
    fn next_search_value_color(&self) -> Color32 {
        let used_colors: Vec<_> = self
            .search_value_entries
            .iter()
            .map(|item| item.color)
            .collect();
        colors::next_search_value_color(&used_colors)
    }

    /// Adds the filter to the session or updates its enabled state in place.
    fn set_filter_entry(&mut self, registry: &mut FilterRegistry, id: Uuid, enabled: bool) -> bool {
        if let Some(item) = self.filter_entries.iter_mut().find(|item| item.id == id) {
            let changed = item.enabled != enabled;
            item.enabled = enabled;
            return changed;
        }

        let colors = self.next_filter_color_pair();
        self.filter_entries
            .push(AppliedFilterState::new(id, enabled, colors));
        registry.apply_filter_to_session(id, self.session_id);
        true
    }

    /// Adds the search value to the session or updates its enabled state in place.
    fn set_search_value_entry(
        &mut self,
        registry: &mut FilterRegistry,
        id: Uuid,
        enabled: bool,
    ) -> bool {
        if let Some(item) = self
            .search_value_entries
            .iter_mut()
            .find(|item| item.id == id)
        {
            let changed = item.enabled != enabled;
            item.enabled = enabled;
            return changed;
        }

        let color = self.next_search_value_color();
        self.search_value_entries
            .push(AppliedSearchValueState::new(id, enabled, color));
        registry.apply_search_value_to_session(id, self.session_id);
        true
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
    pub fn apply_filter(&mut self, registry: &mut FilterRegistry, id: Uuid) -> bool {
        self.set_filter_entry(registry, id, true)
    }

    /// Adds a filter to the session while preserving an explicit enabled state.
    pub fn apply_filter_with_state(
        &mut self,
        registry: &mut FilterRegistry,
        id: Uuid,
        enabled: bool,
    ) -> bool {
        self.set_filter_entry(registry, id, enabled)
    }

    /// Removes the filter from the session entirely.
    pub fn unapply_filter(&mut self, registry: &mut FilterRegistry, id: &Uuid) -> bool {
        if self.is_filter_applied(id) {
            self.filter_entries.retain(|item| item.id != *id);
            registry.unapply_filter_from_session(*id, self.session_id);
            return true;
        }

        false
    }

    /// Swaps the registry definition behind an applied filter while keeping the
    /// session-local row state intact.
    ///
    /// Returns:
    /// - `true` when the current session still has a matching applied row.
    /// - `false` when the session no longer has an applied filter row for
    ///   `current_id`
    pub fn rebind_filter(&mut self, current_id: &Uuid, next_id: Uuid) -> bool {
        if *current_id == next_id {
            return self.is_filter_applied(current_id);
        }

        if let Some(item) = self
            .filter_entries
            .iter_mut()
            .find(|item| item.id == *current_id)
        {
            item.id = next_id;
            return true;
        }

        false
    }

    /// Adds a search value to the session in the enabled state.
    pub fn apply_search_value(&mut self, registry: &mut FilterRegistry, id: Uuid) -> bool {
        self.set_search_value_entry(registry, id, true)
    }

    /// Adds a search value to the session while preserving an explicit enabled state.
    pub fn apply_search_value_with_state(
        &mut self,
        registry: &mut FilterRegistry,
        id: Uuid,
        enabled: bool,
    ) -> bool {
        self.set_search_value_entry(registry, id, enabled)
    }

    /// Removes the search value from the session entirely.
    pub fn unapply_search_value(&mut self, registry: &mut FilterRegistry, id: &Uuid) -> bool {
        if self.is_search_value_applied(id) {
            self.search_value_entries.retain(|item| item.id != *id);
            registry.unapply_search_value_from_session(*id, self.session_id);
            return true;
        }

        false
    }

    /// Swaps the registry definition behind an applied search value while
    /// keeping the session-local row state intact.
    ///
    /// Returns:
    /// - `true` when the current session still has a matching applied row.
    /// - `false` when the session no longer has an applied search-value row for
    ///   `current_id`
    pub fn rebind_search_value(&mut self, current_id: &Uuid, next_id: Uuid) -> bool {
        if *current_id == next_id {
            return self.is_search_value_applied(current_id);
        }

        if let Some(item) = self
            .search_value_entries
            .iter_mut()
            .find(|item| item.id == *current_id)
        {
            item.id = next_id;
            return true;
        }

        false
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::host::common::colors;

    fn new_state() -> FiltersState {
        FiltersState::new(Uuid::new_v4())
    }

    fn add_plain_filter_definition(registry: &mut FilterRegistry, value: &str) -> Uuid {
        let def = FilterDefinition::new(SearchFilter::plain(value).ignore_case(true));
        registry.add_filter(def)
    }

    fn add_regex_filter_definition(registry: &mut FilterRegistry, value: &str) -> Uuid {
        let def = FilterDefinition::new(SearchFilter::plain(value).regex(true).ignore_case(true));
        registry.add_filter(def)
    }

    fn add_search_value_definition(registry: &mut FilterRegistry, value: &str) -> Uuid {
        let def =
            SearchValueDefinition::new(SearchFilter::plain(value).regex(true).ignore_case(true));
        registry.add_search_value(def)
    }

    #[test]
    fn filter_apply_uses_first_free_color() {
        let mut state = new_state();
        let mut registry = FilterRegistry::default();
        let first_id = add_plain_filter_definition(&mut registry, "first");
        let second_id = add_plain_filter_definition(&mut registry, "second");

        state.apply_filter(&mut registry, first_id);
        state.apply_filter(&mut registry, second_id);

        assert_eq!(
            state
                .filter_entries
                .iter()
                .find(|item| item.id == first_id)
                .map(|item| item.colors.clone()),
            Some(colors::FILTER_HIGHLIGHT_COLORS[0].clone())
        );
        assert_eq!(
            state
                .filter_entries
                .iter()
                .find(|item| item.id == second_id)
                .map(|item| item.colors.clone()),
            Some(colors::FILTER_HIGHLIGHT_COLORS[1].clone())
        );
    }

    #[test]
    fn search_value_apply_uses_first_free_color() {
        let mut state = new_state();
        let mut registry = FilterRegistry::default();
        let first_id = add_search_value_definition(&mut registry, "first=(\\d+)");
        let second_id = add_search_value_definition(&mut registry, "second=(\\d+)");

        state.apply_search_value(&mut registry, first_id);
        state.apply_search_value(&mut registry, second_id);

        assert_eq!(
            state
                .search_value_entries
                .iter()
                .find(|item| item.id == first_id)
                .map(|item| item.color),
            Some(colors::search_value_color(0))
        );
        assert_eq!(
            state
                .search_value_entries
                .iter()
                .find(|item| item.id == second_id)
                .map(|item| item.color),
            Some(colors::search_value_color(1))
        );
    }

    #[test]
    fn removing_entry_frees_filter_color() {
        let mut state = new_state();
        let mut registry = FilterRegistry::default();
        let first_id = add_plain_filter_definition(&mut registry, "first");
        let second_id = add_plain_filter_definition(&mut registry, "second");
        let third_id = add_plain_filter_definition(&mut registry, "third");

        state.apply_filter(&mut registry, first_id);
        state.apply_filter(&mut registry, second_id);
        state.unapply_filter(&mut registry, &first_id);
        state.apply_filter(&mut registry, third_id);

        assert_eq!(
            state
                .filter_entries
                .iter()
                .find(|item| item.id == third_id)
                .map(|item| item.colors.clone()),
            Some(colors::FILTER_HIGHLIGHT_COLORS[0].clone())
        );
    }

    #[test]
    fn removing_entry_frees_chart_color() {
        let mut state = new_state();
        let mut registry = FilterRegistry::default();
        let first_id = add_search_value_definition(&mut registry, "first=(\\d+)");
        let second_id = add_search_value_definition(&mut registry, "second=(\\d+)");
        let third_id = add_search_value_definition(&mut registry, "third=(\\d+)");

        state.apply_search_value(&mut registry, first_id);
        state.apply_search_value(&mut registry, second_id);
        state.unapply_search_value(&mut registry, &first_id);
        state.apply_search_value(&mut registry, third_id);

        assert_eq!(
            state
                .search_value_entries
                .iter()
                .find(|item| item.id == third_id)
                .map(|item| item.color),
            Some(colors::search_value_color(0))
        );
    }

    #[test]
    fn reapply_existing_filter_preserves_color() {
        let mut state = new_state();
        let mut registry = FilterRegistry::default();
        let filter_id = add_plain_filter_definition(&mut registry, "first");

        state.apply_filter_with_state(&mut registry, filter_id, false);
        let entry = state
            .filter_entries
            .iter_mut()
            .find(|item| item.id == filter_id)
            .expect("filter entry should exist");
        entry.colors = ColorPair::new(Color32::WHITE, Color32::BLACK);

        state.apply_filter(&mut registry, filter_id);

        let entry = state
            .filter_entries
            .iter()
            .find(|item| item.id == filter_id)
            .expect("filter entry should exist");
        assert!(entry.enabled);
        assert_eq!(entry.colors, ColorPair::new(Color32::WHITE, Color32::BLACK));
    }

    #[test]
    fn toggling_filter_preserves_color() {
        let mut state = new_state();
        let mut registry = FilterRegistry::default();
        let filter_id = add_plain_filter_definition(&mut registry, "first");
        state.apply_filter(&mut registry, filter_id);
        let original = state
            .filter_entries
            .iter()
            .find(|item| item.id == filter_id)
            .expect("filter entry should exist")
            .colors
            .clone();

        assert!(state.set_filter_enabled(&filter_id, false));
        assert!(!state.is_filter_enabled(&filter_id));
        assert_eq!(
            state
                .filter_entries
                .iter()
                .find(|item| item.id == filter_id)
                .map(|item| item.colors.clone()),
            Some(original)
        );
    }

    #[test]
    fn pinning_temp_search_assigns_filter_color() {
        let mut state = new_state();
        let mut registry = FilterRegistry::default();
        state.set_temp_search(SearchFilter::plain("status=ok").ignore_case(true));

        assert!(state.pin_temp_search(&mut registry));

        let entry = state
            .filter_entries
            .first()
            .expect("temp search should become one filter entry");
        assert_eq!(entry.colors, colors::FILTER_HIGHLIGHT_COLORS[0].clone());
    }

    #[test]
    fn pinning_temp_search_reuses_filter() {
        let mut state = new_state();
        let mut registry = FilterRegistry::default();
        let existing_id = add_plain_filter_definition(&mut registry, "status=ok");
        state.set_temp_search(SearchFilter::plain("status=ok").ignore_case(true));

        assert!(state.pin_temp_search(&mut registry));

        assert_eq!(registry.filters_map().len(), 1);
        assert_eq!(state.filter_entries.len(), 1);
        assert_eq!(state.filter_entries[0].id, existing_id);
        assert_eq!(registry.filter_usage_count(&existing_id), 1);
    }

    #[test]
    fn invalid_temp_search_does_not_pin() {
        let mut state = new_state();
        let mut registry = FilterRegistry::default();
        state.set_temp_search(SearchFilter::plain("(").regex(true).ignore_case(true));

        assert!(!state.pin_temp_search(&mut registry));
        assert!(state.filter_entries.is_empty());
        assert!(state.active_temp_search.is_some());
    }

    #[test]
    fn pinning_temp_search_as_value_assigns_chart_color() {
        let mut state = new_state();
        let mut registry = FilterRegistry::default();
        state.set_temp_search(
            SearchFilter::plain("cpu=(\\d+)")
                .regex(true)
                .ignore_case(true),
        );

        assert!(state.pin_temp_search_as_value(&mut registry));

        let entry = state
            .search_value_entries
            .first()
            .expect("temp search should become one search value entry");
        assert_eq!(entry.color, colors::search_value_color(0));
    }

    #[test]
    fn pinning_temp_value_reuses_definition() {
        let mut state = new_state();
        let mut registry = FilterRegistry::default();
        let existing_id = add_search_value_definition(&mut registry, "cpu=(\\d+)");
        state.set_temp_search(
            SearchFilter::plain("cpu=(\\d+)")
                .regex(true)
                .ignore_case(true),
        );

        assert!(state.pin_temp_search_as_value(&mut registry));

        assert_eq!(registry.search_value_map().len(), 1);
        assert_eq!(state.search_value_entries.len(), 1);
        assert_eq!(state.search_value_entries[0].id, existing_id);
        assert_eq!(registry.search_value_usage_count(&existing_id), 1);
    }

    #[test]
    fn reapplying_after_unapply_uses_current_free_color() {
        let mut state = new_state();
        let mut registry = FilterRegistry::default();
        let first_id = add_plain_filter_definition(&mut registry, "first");
        let second_id = add_plain_filter_definition(&mut registry, "second");
        let third_id = add_plain_filter_definition(&mut registry, "third");

        state.apply_filter(&mut registry, first_id);
        state.apply_filter(&mut registry, second_id);
        state.unapply_filter(&mut registry, &first_id);
        state.apply_filter(&mut registry, third_id);
        state.unapply_filter(&mut registry, &third_id);

        state.apply_filter(&mut registry, first_id);

        assert_eq!(
            state
                .filter_entries
                .iter()
                .find(|item| item.id == first_id)
                .map(|item| item.colors.clone()),
            Some(colors::FILTER_HIGHLIGHT_COLORS[0].clone())
        );
    }

    #[test]
    fn filter_to_value_conversion_uses_destination_palette() {
        let mut state = new_state();
        let mut registry = FilterRegistry::default();
        let filter_id = add_regex_filter_definition(&mut registry, "cpu=(\\d+)");
        let existing_value_id = add_search_value_definition(&mut registry, "temp=(\\d+)");

        state.apply_filter_with_state(&mut registry, filter_id, false);
        state.apply_search_value(&mut registry, existing_value_id);
        let was_enabled = state.is_filter_enabled(&filter_id);

        let converted_value_id = registry
            .convert_filter_to_value(filter_id, state.session_id)
            .expect("eligible filter should convert");

        state.unapply_filter(&mut registry, &filter_id);
        state.apply_search_value_with_state(&mut registry, converted_value_id, was_enabled);

        let entry = state
            .search_value_entries
            .iter()
            .find(|item| item.id == converted_value_id)
            .expect("converted search value should exist");
        assert!(!entry.enabled);
        assert_eq!(entry.color, colors::search_value_color(1));
    }

    #[test]
    fn filter_to_value_reuses_existing_value() {
        let mut state = new_state();
        let mut registry = FilterRegistry::default();
        let filter_id = add_regex_filter_definition(&mut registry, "cpu=(\\d+)");
        let existing_value_id = add_search_value_definition(&mut registry, "cpu=(\\d+)");

        state.apply_filter_with_state(&mut registry, filter_id, false);
        state.apply_search_value(&mut registry, existing_value_id);
        state.set_search_value_enabled(&existing_value_id, false);
        let original_color = state
            .search_value_entries
            .iter()
            .find(|item| item.id == existing_value_id)
            .expect("existing value should exist")
            .color;
        let was_enabled = state.is_filter_enabled(&filter_id);

        let converted_value_id = registry
            .convert_filter_to_value(filter_id, state.session_id)
            .expect("eligible filter should convert");

        state.unapply_filter(&mut registry, &filter_id);
        state.apply_search_value_with_state(&mut registry, converted_value_id, was_enabled);

        assert_eq!(converted_value_id, existing_value_id);
        assert_eq!(registry.search_value_map().len(), 1);
        assert_eq!(registry.search_value_usage_count(&existing_value_id), 1);
        assert_eq!(state.search_value_entries.len(), 1);
        assert!(!state.search_value_entries[0].enabled);
        assert_eq!(state.search_value_entries[0].color, original_color);
    }

    #[test]
    fn value_to_filter_conversion_uses_destination_palette() {
        let mut state = new_state();
        let mut registry = FilterRegistry::default();
        let value_id = add_search_value_definition(&mut registry, "cpu=(\\d+)");
        let existing_filter_id = add_plain_filter_definition(&mut registry, "status=ok");

        state.apply_search_value_with_state(&mut registry, value_id, false);
        state.apply_filter(&mut registry, existing_filter_id);
        let was_enabled = state.is_search_value_enabled(&value_id);

        let converted_filter_id = registry
            .convert_value_to_filter(value_id, state.session_id)
            .expect("search value should convert");

        state.unapply_search_value(&mut registry, &value_id);
        state.apply_filter_with_state(&mut registry, converted_filter_id, was_enabled);

        let entry = state
            .filter_entries
            .iter()
            .find(|item| item.id == converted_filter_id)
            .expect("converted filter should exist");
        assert!(!entry.enabled);
        assert_eq!(entry.colors, colors::FILTER_HIGHLIGHT_COLORS[1].clone());
    }

    #[test]
    fn value_to_filter_reuses_existing_filter() {
        let mut state = new_state();
        let mut registry = FilterRegistry::default();
        let value_id = add_search_value_definition(&mut registry, "cpu=(\\d+)");
        let existing_filter_id = add_regex_filter_definition(&mut registry, "cpu=(\\d+)");

        state.apply_search_value_with_state(&mut registry, value_id, false);
        state.apply_filter(&mut registry, existing_filter_id);
        state.set_filter_enabled(&existing_filter_id, false);
        let original_colors = state
            .filter_entries
            .iter()
            .find(|item| item.id == existing_filter_id)
            .expect("existing filter should exist")
            .colors
            .clone();
        let was_enabled = state.is_search_value_enabled(&value_id);

        let converted_filter_id = registry
            .convert_value_to_filter(value_id, state.session_id)
            .expect("search value should convert");

        state.unapply_search_value(&mut registry, &value_id);
        state.apply_filter_with_state(&mut registry, converted_filter_id, was_enabled);

        assert_eq!(converted_filter_id, existing_filter_id);
        assert_eq!(registry.filters_map().len(), 1);
        assert_eq!(registry.filter_usage_count(&existing_filter_id), 1);
        assert_eq!(state.filter_entries.len(), 1);
        assert!(!state.filter_entries[0].enabled);
        assert_eq!(state.filter_entries[0].colors, original_colors);
    }

    #[test]
    fn rebind_filter_preserves_state() {
        let mut state = new_state();
        let mut registry = FilterRegistry::default();
        let first_id = add_plain_filter_definition(&mut registry, "first");
        let second_id = add_plain_filter_definition(&mut registry, "second");
        let replacement_id = add_plain_filter_definition(&mut registry, "replacement");

        state.apply_filter(&mut registry, first_id);
        state.apply_filter_with_state(&mut registry, second_id, false);
        let original_colors = state
            .filter_entries
            .iter()
            .find(|item| item.id == second_id)
            .expect("second filter should exist")
            .colors
            .clone();

        assert!(state.rebind_filter(&second_id, replacement_id));

        assert_eq!(state.filter_entries[0].id, first_id);
        assert_eq!(state.filter_entries[1].id, replacement_id);
        assert!(!state.filter_entries[1].enabled);
        assert_eq!(state.filter_entries[1].colors, original_colors);
    }

    #[test]
    fn rebind_search_value_preserves_state() {
        let mut state = new_state();
        let mut registry = FilterRegistry::default();
        let first_id = add_search_value_definition(&mut registry, "first=(\\d+)");
        let second_id = add_search_value_definition(&mut registry, "second=(\\d+)");
        let replacement_id = add_search_value_definition(&mut registry, "replacement=(\\d+)");

        state.apply_search_value(&mut registry, first_id);
        state.apply_search_value_with_state(&mut registry, second_id, false);
        let original_color = state
            .search_value_entries
            .iter()
            .find(|item| item.id == second_id)
            .expect("second search value should exist")
            .color;

        assert!(state.rebind_search_value(&second_id, replacement_id));

        assert_eq!(state.search_value_entries[0].id, first_id);
        assert_eq!(state.search_value_entries[1].id, replacement_id);
        assert!(!state.search_value_entries[1].enabled);
        assert_eq!(state.search_value_entries[1].color, original_color);
    }
}
