use crate::{
    common::search_value_validation::{SearchValueEligibility, validate_search_value_filter},
    host::common::colors::{self, ColorPair},
};
use egui::Color32;
use processor::search::filter::SearchFilter;
use rustc_hash::{FxHashMap, FxHashSet};
use uuid::Uuid;

/// Represents a filter definition in the global registry.
#[derive(Debug, Clone)]
pub struct FilterDefinition {
    pub id: Uuid,
    pub filter: SearchFilter,
    pub colors: ColorPair,
    pub search_value_eligibility: SearchValueEligibility,
}

impl FilterDefinition {
    pub fn new(filter: SearchFilter, colors: ColorPair) -> Self {
        let search_value_eligibility = validate_search_value_filter(&filter);
        Self {
            id: Uuid::new_v4(),
            filter,
            colors,
            search_value_eligibility,
        }
    }
}

/// Represents a search value definition in the global registry.
#[derive(Debug, Clone)]
pub struct SearchValueDefinition {
    pub id: Uuid,
    pub filter: SearchFilter,
    #[allow(dead_code)]
    pub color: Color32,
}

impl SearchValueDefinition {
    pub fn new(filter: SearchFilter, color: Color32) -> Self {
        Self {
            id: Uuid::new_v4(),
            filter,
            color,
        }
    }
}

/// Global registry of filters and search values shared across all sessions.
/// It tracks which filters are assigned to which sessions.
#[derive(Debug, Default, Clone)]
pub struct FilterRegistry {
    filters: FxHashMap<Uuid, FilterDefinition>,
    search_values: FxHashMap<Uuid, SearchValueDefinition>,
    // Mapping: FilterId -> Set of SessionIds
    filter_usage: FxHashMap<Uuid, FxHashSet<Uuid>>,
    // Mapping: SearchValueId -> Set of SessionIds
    value_usage: FxHashMap<Uuid, FxHashSet<Uuid>>,
}

impl FilterRegistry {
    pub fn get_filter(&self, id: &Uuid) -> Option<&FilterDefinition> {
        self.filters.get(id)
    }

    pub fn filters_map(&self) -> &FxHashMap<Uuid, FilterDefinition> {
        &self.filters
    }

    pub fn get_search_value(&self, id: &Uuid) -> Option<&SearchValueDefinition> {
        self.search_values.get(id)
    }

    pub fn search_value_map(&self) -> &FxHashMap<Uuid, SearchValueDefinition> {
        &self.search_values
    }

    pub fn add_filter(&mut self, filter: FilterDefinition) {
        self.filters.insert(filter.id, filter);
    }

    pub fn add_search_value(&mut self, search_value: SearchValueDefinition) {
        self.search_values.insert(search_value.id, search_value);
    }

    /// Mark a filter as applied to a specific session.
    pub fn apply_filter_to_session(&mut self, filter_id: Uuid, session_id: Uuid) {
        self.filter_usage
            .entry(filter_id)
            .or_default()
            .insert(session_id);
    }

    /// Mark a search value as applied to a specific session.
    pub fn apply_search_value_to_session(&mut self, id: Uuid, session_id: Uuid) {
        self.value_usage.entry(id).or_default().insert(session_id);
    }

    /// Remove a filter from a specific session's tracking.
    pub fn unapply_filter_from_session(&mut self, filter_id: Uuid, session_id: Uuid) {
        if let Some(sessions) = self.filter_usage.get_mut(&filter_id) {
            sessions.remove(&session_id);
        }
    }

    /// Remove a search value from a specific session's tracking.
    pub fn unapply_search_value_from_session(&mut self, id: Uuid, session_id: Uuid) {
        if let Some(sessions) = self.value_usage.get_mut(&id) {
            sessions.remove(&session_id);
        }
    }

    /// Check if a filter is applied to a specific session.
    pub fn is_filter_applied(&self, filter_id: &Uuid, session_id: &Uuid) -> bool {
        self.filter_usage
            .get(filter_id)
            .is_some_and(|s| s.contains(session_id))
    }

    /// Check if a search value is applied to a specific session.
    pub fn is_search_value_applied(&self, id: &Uuid, session_id: &Uuid) -> bool {
        self.value_usage
            .get(id)
            .is_some_and(|s| s.contains(session_id))
    }

    pub fn filter_usage_count(&self, id: &Uuid) -> usize {
        self.filter_usage.get(id).map_or(0, |s| s.len())
    }

    pub fn search_value_usage_count(&self, id: &Uuid) -> usize {
        self.value_usage.get(id).map_or(0, |s| s.len())
    }

    pub fn can_remove_filter(&self, filter_id: &Uuid, session_id: &Uuid) -> bool {
        let count = self.filter_usage_count(filter_id);
        count == 0 || (count == 1 && self.is_filter_applied(filter_id, session_id))
    }

    pub fn can_remove_search_value(&self, id: &Uuid, session_id: &Uuid) -> bool {
        let count = self.search_value_usage_count(id);
        count == 0 || (count == 1 && self.is_search_value_applied(id, session_id))
    }

    pub fn remove_filter(&mut self, id: &Uuid) {
        self.filters.remove(id);
        self.filter_usage.remove(id);
    }

    pub fn remove_search_value(&mut self, id: &Uuid) {
        self.search_values.remove(id);
        self.value_usage.remove(id);
    }

    /// Convert a filter definition into a search value definition.
    ///
    /// The source filter is removed globally only when it is not needed by
    /// other sessions. If it is still in use elsewhere, both definitions are kept.
    pub fn convert_filter_to_value(&mut self, filter_id: Uuid, session_id: Uuid) -> Option<Uuid> {
        let filter_def = self.get_filter(&filter_id)?;
        if !filter_def.search_value_eligibility.is_eligible() {
            return None;
        }

        let used_colors: Vec<_> = self
            .search_values
            .values()
            .map(|value| value.color)
            .collect();
        let search_value_def = SearchValueDefinition::new(
            filter_def.filter.clone(),
            colors::next_search_value_color(&used_colors),
        );
        let search_value_id = search_value_def.id;
        self.add_search_value(search_value_def);

        if self.can_remove_filter(&filter_id, &session_id) {
            self.remove_filter(&filter_id);
        }

        Some(search_value_id)
    }

    /// Convert a search value definition into a filter definition.
    ///
    /// The source search value is removed globally only when it is not needed
    /// by other sessions. If it is still in use elsewhere, both definitions are kept.
    pub fn convert_value_to_filter(&mut self, value_id: Uuid, session_id: Uuid) -> Option<Uuid> {
        let value_def = self.get_search_value(&value_id)?;
        let used_colors: Vec<_> = self
            .filters
            .values()
            .map(|filter| filter.colors.clone())
            .collect();
        let filter_def = FilterDefinition::new(
            value_def.filter.clone(),
            colors::next_filter_color(&used_colors),
        );
        let filter_id = filter_def.id;
        self.add_filter(filter_def);

        if self.can_remove_search_value(&value_id, &session_id) {
            self.remove_search_value(&value_id);
        }

        Some(filter_id)
    }

    /// Cleanup all usage records for a closing session.
    pub(super) fn cleanup_session(&mut self, session_id: &Uuid) {
        for sessions in self.filter_usage.values_mut() {
            sessions.remove(session_id);
        }
        for sessions in self.value_usage.values_mut() {
            sessions.remove(session_id);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn convert_filter_to_value_removes_source() {
        let mut registry = FilterRegistry::default();
        let session_id = Uuid::new_v4();
        let filter_def = FilterDefinition::new(
            SearchFilter::new("cpu=(\\d+)".to_owned(), true, true, false),
            colors::FILTER_HIGHLIGHT_COLORS[0].clone(),
        );
        let filter_id = filter_def.id;
        registry.add_filter(filter_def);
        registry.apply_filter_to_session(filter_id, session_id);

        let value_id = registry
            .convert_filter_to_value(filter_id, session_id)
            .expect("eligible filter should convert");

        assert!(registry.get_filter(&filter_id).is_none());
        assert!(registry.get_search_value(&value_id).is_some());
    }

    #[test]
    fn convert_filter_to_value_keeps_shared_source() {
        let mut registry = FilterRegistry::default();
        let session_id = Uuid::new_v4();
        let other_session_id = Uuid::new_v4();
        let filter_def = FilterDefinition::new(
            SearchFilter::new("cpu=(\\d+)".to_owned(), true, true, false),
            colors::FILTER_HIGHLIGHT_COLORS[0].clone(),
        );
        let filter_id = filter_def.id;
        registry.add_filter(filter_def);
        registry.apply_filter_to_session(filter_id, session_id);
        registry.apply_filter_to_session(filter_id, other_session_id);

        let value_id = registry
            .convert_filter_to_value(filter_id, session_id)
            .expect("eligible filter should convert");

        assert!(registry.get_filter(&filter_id).is_some());
        assert!(registry.get_search_value(&value_id).is_some());
    }

    #[test]
    fn convert_filter_to_value_uses_palette() {
        let mut registry = FilterRegistry::default();
        let session_id = Uuid::new_v4();
        let filter_def = FilterDefinition::new(
            SearchFilter::new("cpu=(\\d+)".to_owned(), true, true, false),
            colors::FILTER_HIGHLIGHT_COLORS[0].clone(),
        );
        let filter_id = filter_def.id;
        registry.add_filter(filter_def);
        registry.apply_filter_to_session(filter_id, session_id);

        let value_id = registry
            .convert_filter_to_value(filter_id, session_id)
            .expect("eligible filter should convert");

        assert_eq!(
            registry
                .get_search_value(&value_id)
                .map(|value| value.color),
            Some(colors::search_value_color(0))
        );
    }

    #[test]
    fn filter_to_value_reuses_color() {
        let mut registry = FilterRegistry::default();
        let session_id = Uuid::new_v4();

        let first = FilterDefinition::new(
            SearchFilter::new("a=(\\d+)".to_owned(), true, true, false),
            colors::FILTER_HIGHLIGHT_COLORS[0].clone(),
        );
        let first_id = first.id;
        registry.add_filter(first);
        registry.apply_filter_to_session(first_id, session_id);

        let second = FilterDefinition::new(
            SearchFilter::new("b=(\\d+)".to_owned(), true, true, false),
            colors::FILTER_HIGHLIGHT_COLORS[1].clone(),
        );
        let second_id = second.id;
        registry.add_filter(second);
        registry.apply_filter_to_session(second_id, session_id);

        let first_value_id = registry
            .convert_filter_to_value(first_id, session_id)
            .expect("first filter should convert");
        let second_value_id = registry
            .convert_filter_to_value(second_id, session_id)
            .expect("second filter should convert");

        registry.remove_search_value(&first_value_id);

        let third = FilterDefinition::new(
            SearchFilter::new("c=(\\d+)".to_owned(), true, true, false),
            colors::FILTER_HIGHLIGHT_COLORS[2].clone(),
        );
        let third_id = third.id;
        registry.add_filter(third);
        registry.apply_filter_to_session(third_id, session_id);

        let third_value_id = registry
            .convert_filter_to_value(third_id, session_id)
            .expect("third filter should convert");

        assert_eq!(
            registry
                .get_search_value(&second_value_id)
                .map(|value| value.color),
            Some(colors::search_value_color(1))
        );
        assert_eq!(
            registry
                .get_search_value(&third_value_id)
                .map(|value| value.color),
            Some(colors::search_value_color(0))
        );
    }

    #[test]
    fn convert_value_to_filter_removes_source() {
        let mut registry = FilterRegistry::default();
        let session_id = Uuid::new_v4();
        let value_def = SearchValueDefinition::new(
            SearchFilter::new("cpu=(\\d+)".to_owned(), true, true, false),
            Color32::LIGHT_BLUE,
        );
        let value_id = value_def.id;
        registry.add_search_value(value_def);
        registry.apply_search_value_to_session(value_id, session_id);

        let filter_id = registry
            .convert_value_to_filter(value_id, session_id)
            .expect("search value should convert");

        assert!(registry.get_search_value(&value_id).is_none());
        assert!(registry.get_filter(&filter_id).is_some());
    }

    #[test]
    fn filter_to_value_rejects_ineligible() {
        let mut registry = FilterRegistry::default();
        let session_id = Uuid::new_v4();
        let filter_def = FilterDefinition::new(
            SearchFilter::new("cpu=(abc)".to_owned(), true, true, false),
            colors::FILTER_HIGHLIGHT_COLORS[0].clone(),
        );
        let filter_id = filter_def.id;
        registry.add_filter(filter_def);

        let result = registry.convert_filter_to_value(filter_id, session_id);

        assert!(result.is_none());
        assert!(registry.get_filter(&filter_id).is_some());
    }

    #[test]
    fn value_to_filter_reuses_color() {
        let mut registry = FilterRegistry::default();
        let session_id = Uuid::new_v4();

        let first = SearchValueDefinition::new(
            SearchFilter::new("a=(\\d+)".to_owned(), true, true, false),
            colors::search_value_color(0),
        );
        let first_id = first.id;
        registry.add_search_value(first);
        registry.apply_search_value_to_session(first_id, session_id);

        let second = SearchValueDefinition::new(
            SearchFilter::new("b=(\\d+)".to_owned(), true, true, false),
            colors::search_value_color(1),
        );
        let second_id = second.id;
        registry.add_search_value(second);
        registry.apply_search_value_to_session(second_id, session_id);

        let first_filter_id = registry
            .convert_value_to_filter(first_id, session_id)
            .expect("first value should convert");
        let second_filter_id = registry
            .convert_value_to_filter(second_id, session_id)
            .expect("second value should convert");

        registry.remove_filter(&first_filter_id);

        let third = SearchValueDefinition::new(
            SearchFilter::new("c=(\\d+)".to_owned(), true, true, false),
            colors::search_value_color(2),
        );
        let third_id = third.id;
        registry.add_search_value(third);
        registry.apply_search_value_to_session(third_id, session_id);

        let third_filter_id = registry
            .convert_value_to_filter(third_id, session_id)
            .expect("third value should convert");

        assert_eq!(
            registry
                .get_filter(&second_filter_id)
                .map(|filter| filter.colors.clone()),
            Some(colors::FILTER_HIGHLIGHT_COLORS[1].clone())
        );
        assert_eq!(
            registry
                .get_filter(&third_filter_id)
                .map(|filter| filter.colors.clone()),
            Some(colors::FILTER_HIGHLIGHT_COLORS[0].clone())
        );
    }
}
