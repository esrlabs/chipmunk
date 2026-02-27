use crate::host::{
    common::colors,
    ui::registry::filters::{FilterDefinition, FilterRegistry, SearchValueDefinition},
};
use egui::Color32;
use processor::search::filter::SearchFilter;
use uuid::Uuid;

/// Maintains the ordered list of filters and search values applied to a specific session.
#[derive(Debug, Clone)]
pub struct FiltersState {
    session_id: Uuid,
    pub applied_filters: Vec<Uuid>,
    pub applied_search_values: Vec<Uuid>,
    pub active_temp_search: Option<SearchFilter>,
}

impl FiltersState {
    pub fn new(session_id: Uuid) -> Self {
        Self {
            session_id,
            applied_filters: Vec::new(),
            applied_search_values: Vec::new(),
            active_temp_search: None,
        }
    }

    pub fn set_temp_search(&mut self, filter: SearchFilter) {
        self.active_temp_search = Some(filter);
    }

    pub fn clear_temp_search(&mut self) {
        self.active_temp_search = None;
    }

    /// Converts the current temporary search into a persistent filter.
    pub fn pin_temp_search(&mut self, registry: &mut FilterRegistry) {
        if let Some(filter) = self.active_temp_search.take() {
            let color_idx = registry.filters_map().len() % colors::HIGHLIGHT_COLORS.len();
            let filter_def =
                FilterDefinition::new(filter, colors::HIGHLIGHT_COLORS[color_idx].clone());
            let filter_id = filter_def.id;
            registry.add_filter(filter_def);
            self.apply_filter(registry, filter_id);
        }
    }

    /// Converts the current temporary search into a global search value.
    /// The temporary search remains active for the session.
    pub fn pin_temp_search_as_value(&mut self, registry: &mut FilterRegistry) {
        if let Some(filter) = &self.active_temp_search {
            let search_value_def = SearchValueDefinition::new(filter.clone(), Color32::LIGHT_BLUE);
            let search_value_id = search_value_def.id;
            registry.add_search_value(search_value_def);
            self.apply_search_value(registry, search_value_id);
        }
    }

    pub fn is_filter_applied(&self, id: &Uuid) -> bool {
        self.applied_filters.contains(id)
    }

    pub fn is_search_value_applied(&self, id: &Uuid) -> bool {
        self.applied_search_values.contains(id)
    }

    pub fn apply_filter(&mut self, registry: &mut FilterRegistry, id: Uuid) {
        if !self.is_filter_applied(&id) {
            self.applied_filters.push(id);
            registry.apply_filter_to_session(id, self.session_id);
        }
    }

    pub fn unapply_filter(&mut self, registry: &mut FilterRegistry, id: &Uuid) {
        if self.is_filter_applied(id) {
            self.applied_filters.retain(|f| f != id);
            registry.unapply_filter_from_session(*id, self.session_id);
        }
    }

    pub fn apply_search_value(&mut self, registry: &mut FilterRegistry, id: Uuid) {
        if !self.is_search_value_applied(&id) {
            self.applied_search_values.push(id);
            registry.apply_search_value_to_session(id, self.session_id);
        }
    }

    pub fn unapply_search_value(&mut self, registry: &mut FilterRegistry, id: &Uuid) {
        if self.is_search_value_applied(id) {
            self.applied_search_values.retain(|v| v != id);
            registry.unapply_search_value_from_session(*id, self.session_id);
        }
    }
}
