use crate::host::common::colors::ColorPair;
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
}

impl FilterDefinition {
    pub fn new(filter: SearchFilter, colors: ColorPair) -> Self {
        Self {
            id: Uuid::new_v4(),
            filter,
            colors,
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

    #[allow(dead_code)]
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
