//! Session state for Find in Search Results.

use processor::search::filter::SearchFilter;

use crate::common::validation::{ValidationEligibility, validate_filter};

/// Canonical state tied to the current primary search lifecycle.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct NestedSearchState {
    visible: bool,
    active_filter: Option<SearchFilter>,
    anchor: Option<u64>,
    status: NestedSearchStatus,
}

/// Local nested-search status before backend navigation is connected.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub enum NestedSearchStatus {
    #[default]
    Idle,
    Active,
}

impl NestedSearchState {
    /// Returns whether the nested-search UI should be rendered.
    pub fn is_visible(&self) -> bool {
        self.visible
    }

    /// Shows nested search without changing its active filter.
    pub fn open(&mut self) {
        self.visible = true;
    }

    /// Clears all nested state when the widget closes or its primary search changes.
    pub fn close(&mut self) {
        *self = Self::default();
    }

    /// Applies a complete filter, resetting navigation only when its semantics changed.
    pub fn apply_filter(&mut self, filter: SearchFilter) -> ValidationEligibility {
        let eligibility = validate_filter(&filter);
        if !eligibility.is_eligible() {
            return eligibility;
        }

        let Self {
            visible: _,
            active_filter,
            anchor,
            status,
        } = self;
        if active_filter.as_ref() != Some(&filter) {
            *anchor = None;
        }
        *active_filter = Some(filter);
        *status = NestedSearchStatus::Active;

        eligibility
    }

    /// Drops the active filter while keeping the widget open.
    pub fn clear_filter(&mut self) {
        let Self {
            visible: _,
            active_filter,
            anchor,
            status,
        } = self;
        *active_filter = None;
        *anchor = None;
        *status = NestedSearchStatus::Idle;
    }
}

#[cfg(test)]
mod tests {
    use processor::search::filter::SearchFilter;

    use super::{NestedSearchState, NestedSearchStatus};
    use crate::common::validation::ValidationEligibility;

    fn complete_filter() -> SearchFilter {
        SearchFilter::plain("status=(ok|warn)")
            .regex(true)
            .ignore_case(true)
            .word(true)
    }

    #[test]
    fn close_clears_complete_state() {
        let mut state = NestedSearchState::default();
        state.open();
        assert!(state.apply_filter(complete_filter()).is_eligible());
        state.anchor = Some(7);

        state.close();

        assert_eq!(state, NestedSearchState::default());
    }

    #[test]
    fn flag_change_replaces_filter_and_clears_anchor() {
        let mut state = NestedSearchState::default();
        let filter = complete_filter();
        assert!(state.apply_filter(filter.clone()).is_eligible());
        state.anchor = Some(7);

        let changed_filter = filter.ignore_case(false);
        assert!(state.apply_filter(changed_filter.clone()).is_eligible());

        assert_eq!(state.active_filter.as_ref(), Some(&changed_filter));
        assert_eq!(state.anchor, None);
    }

    #[test]
    fn same_filter_preserves_anchor() {
        let mut state = NestedSearchState::default();
        let filter = complete_filter();
        assert!(state.apply_filter(filter.clone()).is_eligible());
        state.anchor = Some(7);

        assert!(state.apply_filter(filter).is_eligible());

        assert_eq!(state.anchor, Some(7));
    }

    #[test]
    fn empty_submission_drops_filter_without_closing() {
        let mut state = NestedSearchState::default();
        state.open();
        assert!(state.apply_filter(complete_filter()).is_eligible());
        state.anchor = Some(7);

        state.clear_filter();

        assert!(state.is_visible());
        assert!(state.active_filter.is_none());
        assert_eq!(state.anchor, None);
        assert_eq!(state.status, NestedSearchStatus::Idle);
    }

    #[test]
    fn invalid_regex_preserves_filter_and_anchor() {
        let mut state = NestedSearchState::default();
        let filter = complete_filter();
        assert!(state.apply_filter(filter.clone()).is_eligible());
        state.anchor = Some(7);

        let eligibility = state.apply_filter(SearchFilter::plain("(").regex(true));

        assert!(matches!(
            eligibility,
            ValidationEligibility::Ineligible { .. }
        ));
        assert_eq!(state.active_filter.as_ref(), Some(&filter));
        assert_eq!(state.anchor, Some(7));
        assert_eq!(state.status, NestedSearchStatus::Active);
    }
}
