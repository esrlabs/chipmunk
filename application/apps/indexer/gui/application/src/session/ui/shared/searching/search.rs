//! Session-side state for the log search pipeline.
//!
//! [`SearchState`] tracks the active backend search operation, the lower-table counts derived from
//! that pipeline, and the row-level match metadata used by the logs and search-result tables.
//! It is specific to log searching; chart value extraction is tracked separately in
//! [`SearchValuesState`](super::SearchValuesState).

use processor::search::filter::{self, SearchFilter};
use regex::Regex;
use rustc_hash::FxHashMap;
use stypes::FilterMatch;
use uuid::Uuid;

use crate::session::types::OperationPhase;
use crate::{
    host::ui::registry::filters::FilterRegistry, session::ui::definitions::UpdateOperationOutcome,
};

use super::FiltersState;

#[derive(Debug, Clone, Copy)]
pub struct FilterIndex(pub u8);

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct LogMainIndex(pub u64);

#[derive(Debug, Clone)]
struct SearchOperation {
    pub id: Uuid,
    pub phase: OperationPhase,
}

impl SearchOperation {
    pub fn new(id: Uuid) -> Self {
        Self {
            id,
            phase: OperationPhase::Initializing,
        }
    }
}

#[derive(Debug, Default)]
struct SearchCounts {
    /// Count of backend search matches only. Indexed-only rows like bookmarks are excluded.
    search_result_count: u64,
    /// Count of rows materialized in the indexed lower-table view.
    ///
    /// This includes the active search rows plus pinned indexed rows such as bookmarks.
    indexed_result_count: u64,
}

impl SearchCounts {
    /// Clears the tracked backend search matches while preserving indexed-only rows.
    ///
    /// The indexed lower-table count includes both search rows and pinned indexed rows such as
    /// bookmarks, so only the search-owned portion is removed here.
    fn reset_search_counts(&mut self) {
        let Self {
            search_result_count,
            indexed_result_count,
        } = self;

        // `DropSearch` removes only search entries from the indexed map. The lower-table count
        // therefore keeps whatever pinned rows were already present, such as bookmarks.
        *indexed_result_count = indexed_result_count.saturating_sub(*search_result_count);
        *search_result_count = 0;
    }
}

#[derive(Debug)]
pub struct SearchState {
    /// Active backend operation for the current log search, if one is in flight or retained.
    search_op: Option<SearchOperation>,
    /// Backend-owned row counts for the active log search projection.
    counts: SearchCounts,
    /// Row-level backend match metadata keyed by original main-log position.
    matches_map: Option<FxHashMap<LogMainIndex, Vec<FilterIndex>>>,
    /// Compiled regex matchers for the current effective log-search filters.
    ///
    /// # Note:
    ///
    /// Must stay in the same backend filter index order as `ApplySearchFilter.filters`.
    compiled_filters: Vec<Regex>,
}

impl SearchState {
    pub fn new(_session_id: Uuid) -> Self {
        Self {
            search_op: None,
            counts: SearchCounts::default(),
            matches_map: None,
            compiled_filters: Vec::new(),
        }
    }

    /// Clears all log-search state after the active search is dropped or replaced.
    ///
    /// This keeps the lower indexed count locally in sync with the drop-then-apply UI flow:
    /// when search rows are removed, only the non-search indexed rows such as bookmarks remain.
    pub fn drop_search(&mut self) {
        let Self {
            search_op,
            counts,
            matches_map,
            compiled_filters: _,
        } = self;

        counts.reset_search_counts();
        *search_op = None;
        *matches_map = None;
    }

    pub fn get_active_filters(
        &self,
        filters_state: &FiltersState,
        registry: &FilterRegistry,
    ) -> Vec<SearchFilter> {
        let mut filters: Vec<_> = filters_state
            .enabled_filter_ids()
            .filter_map(|uuid| registry.get_filter(uuid))
            .map(|def| def.filter.clone())
            .collect();

        if let Some(active) = &filters_state.active_temp_search {
            filters.push(active.filter().clone());
        }

        filters
    }

    /// Rebuilds cached regex matchers from the current effective search filters.
    pub fn refresh_compiled_filters(&mut self, filters: &[SearchFilter]) {
        self.compiled_filters = filters
            .iter()
            .filter_map(|filter| Regex::new(&filter::as_regex(filter)).ok())
            .collect();
    }

    /// Clears cached regex matchers when no effective search filters remain.
    pub fn clear_compiled_filters(&mut self) {
        self.compiled_filters.clear();
    }

    /// Returns compiled regex matchers in backend filter index order.
    pub fn compiled_filters(&self) -> &[Regex] {
        &self.compiled_filters
    }

    /// Returns the current backend search match count.
    pub fn search_result_count(&self) -> u64 {
        self.counts.search_result_count
    }

    /// Returns the current lower-table indexed count.
    ///
    /// This may include search rows, bookmarks, and other indexed entries owned by the backend.
    pub fn indexed_result_count(&self) -> u64 {
        self.counts.indexed_result_count
    }

    /// Updates the backend search match count without touching indexed-only rows.
    pub fn set_search_result_count(&mut self, count: u64) {
        self.counts.search_result_count = count;
    }

    /// Updates the current lower-table indexed count from backend indexed-map notifications.
    pub fn set_indexed_result_count(&mut self, count: u64) {
        self.counts.indexed_result_count = count;
    }

    /// Starts tracking a new search operation and resets its phase to initializing.
    pub fn set_search_operation(&mut self, operation_id: Uuid) {
        self.search_op = Some(SearchOperation::new(operation_id));
    }

    /// Returns the active operation ID while the search is still running.
    pub fn processing_search_operation(&self) -> Option<Uuid> {
        self.search_op.as_ref().and_then(|op| {
            if op.phase != OperationPhase::Done {
                Some(op.id)
            } else {
                None
            }
        })
    }

    pub fn search_operation_phase(&self) -> Option<OperationPhase> {
        self.search_op.as_ref().map(|op| op.phase)
    }

    pub fn is_search_active(&self) -> bool {
        self.search_op.is_some()
    }

    /// Updates the tracked operation phase when the callback belongs to the active search.
    pub fn update_operation(
        &mut self,
        operation_id: Uuid,
        phase: OperationPhase,
    ) -> UpdateOperationOutcome {
        if let Some(search_op) = &mut self.search_op
            && search_op.id == operation_id
        {
            search_op.phase = phase;
            UpdateOperationOutcome::Consumed
        } else {
            UpdateOperationOutcome::None
        }
    }

    /// Merges incremental backend match updates into the row-level match map.
    pub fn append_matches(&mut self, filter_matches: Vec<FilterMatch>) {
        let Some(operation) = &mut self.search_op else {
            return;
        };

        operation.phase = OperationPhase::Done;

        let matches_map = self.matches_map.get_or_insert_default();

        filter_matches.into_iter().for_each(|mat| {
            matches_map.insert(
                LogMainIndex(mat.index),
                mat.filters.into_iter().map(FilterIndex).collect(),
            );
        });
    }

    /// Clears row-level matches and the reported result count while preserving operation state.
    ///
    /// This is used when the backend search-map payload is removed without treating it as a full
    /// local `drop_search()` reset.
    pub fn clear_matches(&mut self) {
        let Self {
            search_op: _,
            counts,
            matches_map,
            compiled_filters: _,
        } = self;

        counts.reset_search_counts();
        *matches_map = None;
    }

    /// Returns the per-row filter matches used for row coloring and search-table highlights.
    pub fn current_matches_map(&self) -> Option<&FxHashMap<LogMainIndex, Vec<FilterIndex>>> {
        self.matches_map.as_ref()
    }
}

#[cfg(test)]
mod tests {
    use processor::search::filter::SearchFilter;
    use uuid::Uuid;

    use crate::session::{types::OperationPhase, ui::definitions::UpdateOperationOutcome};

    use super::{SearchCounts, SearchState};

    fn sample_match() -> stypes::FilterMatch {
        stypes::FilterMatch {
            index: 42,
            filters: vec![1, 3],
        }
    }

    fn sample_filters() -> Vec<SearchFilter> {
        vec![
            SearchFilter::plain("status=ok"),
            SearchFilter::plain("warning").ignore_case(true),
        ]
    }

    #[test]
    fn zero_count_keeps_pinned() {
        let mut counts = SearchCounts {
            search_result_count: 4,
            indexed_result_count: 9,
        };

        counts.reset_search_counts();

        assert_eq!(counts.search_result_count, 0);
        assert_eq!(counts.indexed_result_count, 5);
    }

    #[test]
    fn zero_count_saturates() {
        let mut counts = SearchCounts {
            search_result_count: 4,
            indexed_result_count: 2,
        };

        counts.reset_search_counts();

        assert_eq!(counts.search_result_count, 0);
        assert_eq!(counts.indexed_result_count, 0);
    }

    #[test]
    fn clear_matches_keeps_phase() {
        let operation_id = Uuid::new_v4();
        let mut state = SearchState::new(Uuid::new_v4());
        state.set_search_operation(operation_id);
        state.set_search_result_count(2);
        state.set_indexed_result_count(7);
        state.append_matches(vec![sample_match()]);

        state.clear_matches();

        assert!(state.processing_search_operation().is_none());
        assert_eq!(state.search_operation_phase(), Some(OperationPhase::Done));
        assert_eq!(state.search_result_count(), 0);
        assert_eq!(state.indexed_result_count(), 5);
        assert!(state.current_matches_map().is_none());
        let outcome = state.update_operation(operation_id, OperationPhase::Processing);
        assert!(matches!(outcome, UpdateOperationOutcome::Consumed));
    }

    #[test]
    fn drop_search_syncs_counts() {
        let operation_id = Uuid::new_v4();
        let mut state = SearchState::new(Uuid::new_v4());
        state.set_search_operation(operation_id);
        state.set_search_result_count(4);
        state.set_indexed_result_count(9);
        state.append_matches(vec![sample_match()]);

        state.drop_search();

        assert!(state.processing_search_operation().is_none());
        assert!(state.search_operation_phase().is_none());
        assert_eq!(state.search_result_count(), 0);
        assert_eq!(state.indexed_result_count(), 5);
        assert!(state.current_matches_map().is_none());
    }

    #[test]
    fn drop_search_saturates_indexed() {
        let mut state = SearchState::new(Uuid::new_v4());
        state.set_search_result_count(4);
        state.set_indexed_result_count(2);

        state.drop_search();

        assert_eq!(state.search_result_count(), 0);
        assert_eq!(state.indexed_result_count(), 0);
    }

    #[test]
    fn update_operation_ignores_other() {
        let mut state = SearchState::new(Uuid::new_v4());
        state.set_search_operation(Uuid::new_v4());

        let outcome = state.update_operation(Uuid::new_v4(), OperationPhase::Processing);

        assert!(matches!(outcome, UpdateOperationOutcome::None));
        assert_eq!(
            state.search_operation_phase(),
            Some(OperationPhase::Initializing)
        );
    }

    #[test]
    fn refresh_compiled_filters_follows_order() {
        let mut state = SearchState::new(Uuid::new_v4());

        state.refresh_compiled_filters(&sample_filters());

        let compiled = state.compiled_filters();
        assert_eq!(compiled.len(), 2);
        assert!(compiled[0].is_match("status=ok"));
        assert!(!compiled[0].is_match("STATUS=OK"));
        assert!(compiled[1].is_match("WARNING"));
    }

    #[test]
    fn clear_compiled_filters_empties_cache() {
        let mut state = SearchState::new(Uuid::new_v4());
        state.refresh_compiled_filters(&sample_filters());

        state.clear_compiled_filters();

        assert!(state.compiled_filters().is_empty());
    }
}
