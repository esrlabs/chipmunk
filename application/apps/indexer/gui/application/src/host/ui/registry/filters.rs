use crate::common::validation::ValidationEligibility;
use crate::common::validation::{validate_filter_regex_enable, validate_search_value_filter};
use processor::search::filter::SearchFilter;
use rustc_hash::{FxHashMap, FxHashSet};
use uuid::Uuid;

/// Represents a filter definition in the global registry.
#[derive(Debug, Clone)]
pub struct FilterDefinition {
    pub id: Uuid,
    pub filter: SearchFilter,
    /// Indicator if the filter can be converted to a chart search-value.
    pub search_value_eligibility: ValidationEligibility,
    /// Indicator if the current text can safely enable regex mode in the UI.
    pub regex_enable_eligibility: ValidationEligibility,
}

impl FilterDefinition {
    /// Creates a registry-owned filter definition and caches whether it can
    /// later be converted into a search value.
    pub fn new(filter: SearchFilter) -> Self {
        let search_value_eligibility = validate_search_value_filter(&filter);
        let regex_enable_eligibility = validate_filter_regex_enable(&filter);
        Self {
            id: Uuid::new_v4(),
            filter,
            search_value_eligibility,
            regex_enable_eligibility,
        }
    }
}

/// Represents a search value definition in the global registry.
#[derive(Debug, Clone)]
pub struct SearchValueDefinition {
    pub id: Uuid,
    pub filter: SearchFilter,
}

impl SearchValueDefinition {
    /// Creates a registry-owned search value definition.
    pub fn new(filter: SearchFilter) -> Self {
        Self {
            id: Uuid::new_v4(),
            filter,
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

/// Outcome of editing one session's view of a registry definition.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RegistryEditOutcome {
    /// The definition does not exist, or the session no longer references it.
    NotFound,
    /// The existing definition was updated in place and the definition id is unchanged.
    EditedInPlace,
    /// The session was moved to a different registry definition id.
    ///
    /// This happens only for shared definitions. The edit cannot mutate the
    /// shared definition in place, so the session is reassigned either to a
    /// newly created definition or to an already existing equivalent one.
    Reassigned(Uuid),
}

impl FilterRegistry {
    /// Returns the immutable filter definition used by UI rendering and sync.
    pub fn get_filter(&self, id: &Uuid) -> Option<&FilterDefinition> {
        self.filters.get(id)
    }

    /// Exposes the full filter registry for read-only library views.
    pub fn filters_map(&self) -> &FxHashMap<Uuid, FilterDefinition> {
        &self.filters
    }

    /// Returns the immutable search value definition used by UI rendering and sync.
    pub fn get_search_value(&self, id: &Uuid) -> Option<&SearchValueDefinition> {
        self.search_values.get(id)
    }

    /// Exposes the full search-value registry for read-only library views.
    pub fn search_value_map(&self) -> &FxHashMap<Uuid, SearchValueDefinition> {
        &self.search_values
    }

    /// Inserts a new global filter definition without attaching it to a session.
    ///
    /// Existing semantic definitions are reused via a linear scan instead of
    /// creating another UUID for the same filter.
    pub fn add_filter(&mut self, filter: FilterDefinition) -> Uuid {
        if let Some(existing_id) = self
            .filters
            .iter()
            .find_map(|(id, def)| (def.filter == filter.filter).then_some(*id))
        {
            return existing_id;
        }

        let id = filter.id;
        self.filters.insert(id, filter);
        id
    }

    /// Inserts a new global search-value definition without attaching it to a session.
    ///
    /// Existing semantic definitions are reused via a linear scan instead of
    /// creating another UUID for the same filter.
    pub fn add_search_value(&mut self, search_value: SearchValueDefinition) -> Uuid {
        if let Some(existing_id) = self
            .search_values
            .iter()
            .find_map(|(id, def)| (def.filter == search_value.filter).then_some(*id))
        {
            return existing_id;
        }

        let id = search_value.id;
        self.search_values.insert(id, search_value);
        id
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

    /// Returns how many sessions currently reference the filter.
    pub fn filter_usage_count(&self, id: &Uuid) -> usize {
        self.filter_usage.get(id).map_or(0, |s| s.len())
    }

    /// Returns how many sessions currently reference the search value.
    pub fn search_value_usage_count(&self, id: &Uuid) -> usize {
        self.value_usage.get(id).map_or(0, |s| s.len())
    }

    /// A definition can be removed only when unused or used solely by the
    /// requesting session.
    pub fn can_remove_filter(&self, filter_id: &Uuid, session_id: &Uuid) -> bool {
        let count = self.filter_usage_count(filter_id);
        count == 0 || (count == 1 && self.is_filter_applied(filter_id, session_id))
    }

    /// A definition can be removed only when unused or used solely by the
    /// requesting session.
    pub fn can_remove_search_value(&self, id: &Uuid, session_id: &Uuid) -> bool {
        let count = self.search_value_usage_count(id);
        count == 0 || (count == 1 && self.is_search_value_applied(id, session_id))
    }

    /// Removes the filter definition and all of its session usage tracking.
    pub fn remove_filter(&mut self, id: &Uuid) {
        self.filters.remove(id);
        self.filter_usage.remove(id);
    }

    /// Removes the search-value definition and all of its session usage tracking.
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

        let search_value_id =
            self.add_search_value(SearchValueDefinition::new(filter_def.filter.clone()));

        if self.can_remove_filter(&filter_id, &session_id) {
            self.remove_filter(&filter_id);
        }

        Some(search_value_id)
    }

    /// Updates one session's filter definition in place when possible.
    ///
    /// For shared definitions, the edit keeps the shared source untouched and
    /// reassigns only this session to another definition id. That target id may
    /// belong to a freshly created definition or to an already existing
    /// equivalent definition.
    pub fn edit_filter_for_session(
        &mut self,
        filter_id: Uuid,
        session_id: Uuid,
        next_filter: SearchFilter,
    ) -> RegistryEditOutcome {
        if !self.is_filter_applied(&filter_id, &session_id) {
            log::warn!(
                "edit_filter_for_session called for unapplied filter {filter_id}\
                in session {session_id}"
            );
            return RegistryEditOutcome::NotFound;
        }

        if self.filter_usage_count(&filter_id) <= 1 {
            let Some(filter_def) = self.filters.get_mut(&filter_id) else {
                return RegistryEditOutcome::NotFound;
            };
            filter_def.filter = next_filter;
            filter_def.search_value_eligibility = validate_search_value_filter(&filter_def.filter);
            filter_def.regex_enable_eligibility = validate_filter_regex_enable(&filter_def.filter);
            return RegistryEditOutcome::EditedInPlace;
        }

        let next_id = self.add_filter(FilterDefinition::new(next_filter));
        if next_id == filter_id {
            return RegistryEditOutcome::EditedInPlace;
        }
        self.unapply_filter_from_session(filter_id, session_id);
        self.apply_filter_to_session(next_id, session_id);

        RegistryEditOutcome::Reassigned(next_id)
    }

    /// Updates one session's search-value definition in place when possible.
    ///
    /// For shared definitions, the edit keeps the shared source untouched and
    /// reassigns only this session to another definition id. That target id may
    /// belong to a freshly created definition or to an already existing
    /// equivalent definition.
    pub fn edit_search_value_for_session(
        &mut self,
        value_id: Uuid,
        session_id: Uuid,
        next_filter: SearchFilter,
    ) -> RegistryEditOutcome {
        if !self.is_search_value_applied(&value_id, &session_id) {
            log::warn!(
                "edit_search_value_for_session called for unapplied search value {value_id}\
                in session {session_id}"
            );
            return RegistryEditOutcome::NotFound;
        }

        if self.search_value_usage_count(&value_id) <= 1 {
            let Some(value_def) = self.search_values.get_mut(&value_id) else {
                return RegistryEditOutcome::NotFound;
            };
            value_def.filter = next_filter;
            return RegistryEditOutcome::EditedInPlace;
        }

        let next_id = self.add_search_value(SearchValueDefinition::new(next_filter));
        if next_id == value_id {
            return RegistryEditOutcome::EditedInPlace;
        }
        self.unapply_search_value_from_session(value_id, session_id);
        self.apply_search_value_to_session(next_id, session_id);

        RegistryEditOutcome::Reassigned(next_id)
    }

    /// Convert a search value definition into a filter definition.
    ///
    /// The source search value is removed globally only when it is not needed
    /// by other sessions. If it is still in use elsewhere, both definitions are kept.
    pub fn convert_value_to_filter(&mut self, value_id: Uuid, session_id: Uuid) -> Option<Uuid> {
        let value_def = self.get_search_value(&value_id)?;
        let filter_id = self.add_filter(FilterDefinition::new(value_def.filter.clone()));

        if self.can_remove_search_value(&value_id, &session_id) {
            self.remove_search_value(&value_id);
        }

        Some(filter_id)
    }

    /// Removes a closing session from usage tracking without deleting any global
    /// filter or search-value definitions.
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
            SearchFilter::plain("cpu=(\\d+)")
                .regex(true)
                .ignore_case(true),
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
            SearchFilter::plain("cpu=(\\d+)")
                .regex(true)
                .ignore_case(true),
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
    fn add_filter_reuses_existing() {
        let mut registry = FilterRegistry::default();
        let first_id = registry.add_filter(FilterDefinition::new(
            SearchFilter::plain("status=ok").ignore_case(true),
        ));

        let reused_id = registry.add_filter(FilterDefinition::new(
            SearchFilter::plain("status=ok").ignore_case(true),
        ));

        assert_eq!(reused_id, first_id);
        assert_eq!(registry.filters_map().len(), 1);
    }

    #[test]
    fn add_value_reuses_existing() {
        let mut registry = FilterRegistry::default();
        let first_id = registry.add_search_value(SearchValueDefinition::new(
            SearchFilter::plain("cpu=(\\d+)")
                .regex(true)
                .ignore_case(true),
        ));

        let reused_id = registry.add_search_value(SearchValueDefinition::new(
            SearchFilter::plain("cpu=(\\d+)")
                .regex(true)
                .ignore_case(true),
        ));

        assert_eq!(reused_id, first_id);
        assert_eq!(registry.search_value_map().len(), 1);
    }

    #[test]
    fn convert_value_to_filter_removes_source() {
        let mut registry = FilterRegistry::default();
        let session_id = Uuid::new_v4();
        let value_def = SearchValueDefinition::new(
            SearchFilter::plain("cpu=(\\d+)")
                .regex(true)
                .ignore_case(true),
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
            SearchFilter::plain("cpu=(abc)")
                .regex(true)
                .ignore_case(true),
        );
        let filter_id = filter_def.id;
        registry.add_filter(filter_def);

        let result = registry.convert_filter_to_value(filter_id, session_id);

        assert!(result.is_none());
        assert!(registry.get_filter(&filter_id).is_some());
    }

    #[test]
    fn edit_filter_updates_single_session() {
        let mut registry = FilterRegistry::default();
        let session_id = Uuid::new_v4();
        let filter_def = FilterDefinition::new(SearchFilter::plain("cpu=(\\d+)"));
        let filter_id = filter_def.id;
        registry.add_filter(filter_def);
        registry.apply_filter_to_session(filter_id, session_id);

        let result = registry.edit_filter_for_session(
            filter_id,
            session_id,
            SearchFilter::plain("cpu=(\\d+)")
                .regex(true)
                .ignore_case(true),
        );

        let edited = registry
            .get_filter(&filter_id)
            .expect("definition should stay in place");
        assert_eq!(result, RegistryEditOutcome::EditedInPlace);
        assert!(edited.filter.is_regex());
        assert!(edited.filter.is_ignore_case());
        assert!(edited.search_value_eligibility.is_eligible());
        assert!(edited.regex_enable_eligibility.is_eligible());
    }

    #[test]
    fn filter_definition_caches_regex_enable_eligibility() {
        let filter_def = FilterDefinition::new(SearchFilter::plain("(").ignore_case(true));

        assert!(matches!(
            filter_def.regex_enable_eligibility,
            ValidationEligibility::Ineligible { .. }
        ));
    }

    #[test]
    fn edit_text_keeps_flags() {
        let mut registry = FilterRegistry::default();
        let session_id = Uuid::new_v4();
        let filter_def = FilterDefinition::new(
            SearchFilter::plain("cpu=(\\d+)")
                .regex(true)
                .ignore_case(true)
                .word(true),
        );
        let filter_id = filter_def.id;
        registry.add_filter(filter_def);
        registry.apply_filter_to_session(filter_id, session_id);

        let result = registry.edit_filter_for_session(
            filter_id,
            session_id,
            SearchFilter::plain("mem=(\\d+)")
                .regex(true)
                .ignore_case(true)
                .word(true),
        );

        let edited = registry
            .get_filter(&filter_id)
            .expect("definition should stay in place");
        assert_eq!(result, RegistryEditOutcome::EditedInPlace);
        assert_eq!(edited.filter.value, "mem=(\\d+)");
        assert!(edited.filter.is_regex());
        assert!(edited.filter.is_ignore_case());
        assert!(edited.filter.is_word());
    }

    #[test]
    fn edit_filter_duplicates_shared_definition() {
        let mut registry = FilterRegistry::default();
        let session_id = Uuid::new_v4();
        let other_session_id = Uuid::new_v4();
        let filter_def = FilterDefinition::new(SearchFilter::plain("cpu=(\\d+)"));
        let filter_id = filter_def.id;
        registry.add_filter(filter_def);
        registry.apply_filter_to_session(filter_id, session_id);
        registry.apply_filter_to_session(filter_id, other_session_id);

        let result = registry.edit_filter_for_session(
            filter_id,
            session_id,
            SearchFilter::plain("cpu=(\\d+)")
                .regex(true)
                .ignore_case(true),
        );
        let RegistryEditOutcome::Reassigned(next_id) = result else {
            panic!("shared edit should duplicate");
        };

        assert_ne!(next_id, filter_id);
        assert!(
            !registry
                .get_filter(&filter_id)
                .expect("original shared definition should stay")
                .filter
                .is_regex()
        );
        assert!(
            registry
                .get_filter(&next_id)
                .expect("duplicate definition should exist")
                .filter
                .is_regex()
        );
        assert!(registry.is_filter_applied(&filter_id, &other_session_id));
        assert!(!registry.is_filter_applied(&filter_id, &session_id));
        assert!(registry.is_filter_applied(&next_id, &session_id));
    }

    #[test]
    fn edit_text_duplicates_shared() {
        let mut registry = FilterRegistry::default();
        let session_id = Uuid::new_v4();
        let other_session_id = Uuid::new_v4();
        let filter_def = FilterDefinition::new(
            SearchFilter::plain("cpu=(\\d+)")
                .regex(true)
                .ignore_case(true),
        );
        let filter_id = filter_def.id;
        registry.add_filter(filter_def);
        registry.apply_filter_to_session(filter_id, session_id);
        registry.apply_filter_to_session(filter_id, other_session_id);

        let result = registry.edit_filter_for_session(
            filter_id,
            session_id,
            SearchFilter::plain("mem=(\\d+)")
                .regex(true)
                .ignore_case(true),
        );
        let RegistryEditOutcome::Reassigned(next_id) = result else {
            panic!("shared edit should duplicate");
        };

        assert_eq!(
            registry
                .get_filter(&filter_id)
                .expect("shared source should stay")
                .filter
                .value,
            "cpu=(\\d+)"
        );
        assert_eq!(
            registry
                .get_filter(&next_id)
                .expect("session duplicate should exist")
                .filter
                .value,
            "mem=(\\d+)"
        );
    }

    #[test]
    fn shared_filter_edit_reuses_existing() {
        let mut registry = FilterRegistry::default();
        let session_id = Uuid::new_v4();
        let other_session_id = Uuid::new_v4();
        let existing_id = registry.add_filter(FilterDefinition::new(
            SearchFilter::plain("cpu=(\\d+)")
                .regex(true)
                .ignore_case(true),
        ));
        let shared_id =
            registry.add_filter(FilterDefinition::new(SearchFilter::plain("cpu=(\\d+)")));
        registry.apply_filter_to_session(shared_id, session_id);
        registry.apply_filter_to_session(shared_id, other_session_id);

        let result = registry.edit_filter_for_session(
            shared_id,
            session_id,
            SearchFilter::plain("cpu=(\\d+)")
                .regex(true)
                .ignore_case(true),
        );
        let RegistryEditOutcome::Reassigned(next_id) = result else {
            panic!("shared edit should rebind to existing definition");
        };

        assert_eq!(next_id, existing_id);
        assert_eq!(registry.filters_map().len(), 2);
        assert_eq!(registry.filter_usage_count(&shared_id), 1);
        assert_eq!(registry.filter_usage_count(&existing_id), 1);
        assert!(registry.is_filter_applied(&shared_id, &other_session_id));
        assert!(!registry.is_filter_applied(&shared_id, &session_id));
        assert!(registry.is_filter_applied(&existing_id, &session_id));
    }

    #[test]
    fn edit_filter_reports_not_found() {
        let mut registry = FilterRegistry::default();

        let result = registry.edit_filter_for_session(
            Uuid::new_v4(),
            Uuid::new_v4(),
            SearchFilter::plain("cpu=(\\d+)"),
        );

        assert_eq!(result, RegistryEditOutcome::NotFound);
    }

    #[test]
    fn edit_search_value_updates_single_session() {
        let mut registry = FilterRegistry::default();
        let session_id = Uuid::new_v4();
        let value_def = SearchValueDefinition::new(
            SearchFilter::plain("cpu=(\\d+)")
                .regex(true)
                .ignore_case(true),
        );
        let value_id = value_def.id;
        registry.add_search_value(value_def);
        registry.apply_search_value_to_session(value_id, session_id);

        let result = registry.edit_search_value_for_session(
            value_id,
            session_id,
            SearchFilter::plain("mem=(\\d+)")
                .regex(true)
                .ignore_case(true),
        );

        let edited = registry
            .get_search_value(&value_id)
            .expect("definition should stay in place");
        assert_eq!(result, RegistryEditOutcome::EditedInPlace);
        assert_eq!(edited.filter.value, "mem=(\\d+)");
        assert!(edited.filter.is_regex());
        assert!(edited.filter.is_ignore_case());
    }

    #[test]
    fn edit_search_value_duplicates_shared_definition() {
        let mut registry = FilterRegistry::default();
        let session_id = Uuid::new_v4();
        let other_session_id = Uuid::new_v4();
        let value_def = SearchValueDefinition::new(
            SearchFilter::plain("cpu=(\\d+)")
                .regex(true)
                .ignore_case(true),
        );
        let value_id = value_def.id;
        registry.add_search_value(value_def);
        registry.apply_search_value_to_session(value_id, session_id);
        registry.apply_search_value_to_session(value_id, other_session_id);

        let result = registry.edit_search_value_for_session(
            value_id,
            session_id,
            SearchFilter::plain("mem=(\\d+)")
                .regex(true)
                .ignore_case(true),
        );
        let RegistryEditOutcome::Reassigned(next_id) = result else {
            panic!("shared edit should duplicate");
        };

        assert_eq!(
            registry
                .get_search_value(&value_id)
                .expect("original shared definition should stay")
                .filter
                .value,
            "cpu=(\\d+)"
        );
        assert_eq!(
            registry
                .get_search_value(&next_id)
                .expect("duplicate definition should exist")
                .filter
                .value,
            "mem=(\\d+)"
        );
        assert!(registry.is_search_value_applied(&value_id, &other_session_id));
        assert!(!registry.is_search_value_applied(&value_id, &session_id));
        assert!(registry.is_search_value_applied(&next_id, &session_id));
    }

    #[test]
    fn shared_value_edit_reuses_existing() {
        let mut registry = FilterRegistry::default();
        let session_id = Uuid::new_v4();
        let other_session_id = Uuid::new_v4();
        let existing_id = registry.add_search_value(SearchValueDefinition::new(
            SearchFilter::plain("cpu=(\\d+)")
                .regex(true)
                .ignore_case(true),
        ));
        let shared_id = registry.add_search_value(SearchValueDefinition::new(
            SearchFilter::plain("cpu=(\\w+)")
                .regex(true)
                .ignore_case(true),
        ));
        registry.apply_search_value_to_session(shared_id, session_id);
        registry.apply_search_value_to_session(shared_id, other_session_id);

        let result = registry.edit_search_value_for_session(
            shared_id,
            session_id,
            SearchFilter::plain("cpu=(\\d+)")
                .regex(true)
                .ignore_case(true),
        );
        let RegistryEditOutcome::Reassigned(next_id) = result else {
            panic!("shared edit should rebind to existing definition");
        };

        assert_eq!(next_id, existing_id);
        assert_eq!(registry.search_value_map().len(), 2);
        assert_eq!(registry.search_value_usage_count(&shared_id), 1);
        assert_eq!(registry.search_value_usage_count(&existing_id), 1);
        assert!(registry.is_search_value_applied(&shared_id, &other_session_id));
        assert!(!registry.is_search_value_applied(&shared_id, &session_id));
        assert!(registry.is_search_value_applied(&existing_id, &session_id));
    }

    #[test]
    fn edit_search_value_reports_not_found() {
        let mut registry = FilterRegistry::default();

        let result = registry.edit_search_value_for_session(
            Uuid::new_v4(),
            Uuid::new_v4(),
            SearchFilter::plain("cpu=(\\d+)")
                .regex(true)
                .ignore_case(true),
        );

        assert_eq!(result, RegistryEditOutcome::NotFound);
    }

    #[test]
    fn convert_value_to_filter_keeps_shared_source() {
        let mut registry = FilterRegistry::default();
        let session_id = Uuid::new_v4();
        let other_session_id = Uuid::new_v4();

        let value_def = SearchValueDefinition::new(
            SearchFilter::plain("cpu=(\\d+)")
                .regex(true)
                .ignore_case(true),
        );
        let value_id = value_def.id;
        registry.add_search_value(value_def);
        registry.apply_search_value_to_session(value_id, session_id);
        registry.apply_search_value_to_session(value_id, other_session_id);

        let filter_id = registry
            .convert_value_to_filter(value_id, session_id)
            .expect("search value should convert");

        assert!(registry.get_search_value(&value_id).is_some());
        assert!(registry.get_filter(&filter_id).is_some());
    }

    #[test]
    fn convert_value_reuses_existing_filter() {
        let mut registry = FilterRegistry::default();
        let session_id = Uuid::new_v4();
        let existing_filter_id = registry.add_filter(FilterDefinition::new(
            SearchFilter::plain("cpu=(\\d+)")
                .regex(true)
                .ignore_case(true),
        ));
        let value_id = registry.add_search_value(SearchValueDefinition::new(
            SearchFilter::plain("cpu=(\\d+)")
                .regex(true)
                .ignore_case(true),
        ));
        registry.apply_search_value_to_session(value_id, session_id);

        let filter_id = registry
            .convert_value_to_filter(value_id, session_id)
            .expect("search value should convert");

        assert_eq!(filter_id, existing_filter_id);
        assert_eq!(registry.filters_map().len(), 1);
        assert!(registry.get_search_value(&value_id).is_none());
    }
}
