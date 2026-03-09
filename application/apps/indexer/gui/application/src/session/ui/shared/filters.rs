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

    /// Adds a search value to the session while preserving
    /// an explicit enabled state.
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn pin_temp_search_as_value_uses_palette() {
        let session_id = Uuid::new_v4();
        let mut state = FiltersState::new(session_id);
        let mut registry = FilterRegistry::default();
        state.set_temp_search(SearchFilter::new(
            "cpu=(\\d+)".to_owned(),
            true,
            true,
            false,
        ));

        assert!(state.pin_temp_search_as_value(&mut registry));

        let value_id = state.search_value_entries[0].id;
        assert_eq!(
            registry
                .get_search_value(&value_id)
                .map(|value| value.color),
            Some(crate::host::common::colors::search_value_color(0))
        );
    }

    #[test]
    fn pin_temp_search_reuses_color() {
        let session_id = Uuid::new_v4();
        let mut state = FiltersState::new(session_id);
        let mut registry = FilterRegistry::default();

        let first = FilterDefinition::new(
            SearchFilter::new("a".to_owned(), false, true, false),
            colors::FILTER_HIGHLIGHT_COLORS[0].clone(),
        );
        let first_id = first.id;
        registry.add_filter(first);

        let second = FilterDefinition::new(
            SearchFilter::new("b".to_owned(), false, true, false),
            colors::FILTER_HIGHLIGHT_COLORS[1].clone(),
        );
        registry.add_filter(second);

        registry.remove_filter(&first_id);

        state.set_temp_search(SearchFilter::new("c".to_owned(), false, true, false));
        state.pin_temp_search(&mut registry);

        let filter_id = state.filter_entries[0].id;
        assert_eq!(
            registry
                .get_filter(&filter_id)
                .map(|filter| filter.colors.clone()),
            Some(colors::FILTER_HIGHLIGHT_COLORS[0].clone())
        );
    }

    #[test]
    fn pin_temp_chart_reuses_color() {
        let session_id = Uuid::new_v4();
        let mut state = FiltersState::new(session_id);
        let mut registry = FilterRegistry::default();

        let first = SearchValueDefinition::new(
            SearchFilter::new("a=(\\d+)".to_owned(), true, true, false),
            colors::search_value_color(0),
        );
        let first_id = first.id;
        registry.add_search_value(first);

        let second = SearchValueDefinition::new(
            SearchFilter::new("b=(\\d+)".to_owned(), true, true, false),
            colors::search_value_color(1),
        );
        registry.add_search_value(second);

        registry.remove_search_value(&first_id);

        state.set_temp_search(SearchFilter::new("c=(\\d+)".to_owned(), true, true, false));
        assert!(state.pin_temp_search_as_value(&mut registry));

        let value_id = state.search_value_entries[0].id;
        assert_eq!(
            registry
                .get_search_value(&value_id)
                .map(|value| value.color),
            Some(colors::search_value_color(0))
        );
    }

    #[test]
    fn apply_filter_defaults_enabled() {
        let session_id = Uuid::new_v4();
        let mut state = FiltersState::new(session_id);
        let mut registry = FilterRegistry::default();
        let filter_id = Uuid::new_v4();

        state.apply_filter(&mut registry, filter_id);

        assert!(state.is_filter_applied(&filter_id));
        assert!(state.is_filter_enabled(&filter_id));
        assert_eq!(
            state.enabled_filter_ids().copied().collect::<Vec<_>>(),
            vec![filter_id]
        );
    }

    #[test]
    fn toggle_filter_keeps_order() {
        let session_id = Uuid::new_v4();
        let mut state = FiltersState::new(session_id);
        let mut registry = FilterRegistry::default();
        let first = Uuid::new_v4();
        let second = Uuid::new_v4();

        state.apply_filter(&mut registry, first);
        state.apply_filter(&mut registry, second);

        assert!(state.set_filter_enabled(&first, false));

        assert_eq!(
            state
                .filter_entries
                .iter()
                .map(|item| item.id)
                .collect::<Vec<_>>(),
            vec![first, second]
        );
        assert_eq!(
            state.enabled_filter_ids().copied().collect::<Vec<_>>(),
            vec![second]
        );
    }
}
