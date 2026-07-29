//! Session state for Find in Search Results.

use processor::search::filter::SearchFilter;
use session_core::state::IndexedNavigation;
use tokio::sync::mpsc::Sender;
use uuid::Uuid;

use crate::{
    common::validation::{ValidationEligibility, validate_filter},
    host::ui::UiActions,
    session::command::SessionCommand,
};

/// Canonical state tied to the current primary search lifecycle.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct NestedSearchState {
    visible: bool,
    active_filter: Option<SearchFilter>,
    anchor: Option<u64>,
    pending_request: Option<Uuid>,
    status: NestedSearchStatus,
}

/// Outcome of the most recently completed nested navigation.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub enum NestedSearchStatus {
    #[default]
    Idle,
    Active,
    NoMatch,
}

impl NestedSearchState {
    /// Returns whether the nested-search UI should be rendered.
    pub fn is_visible(&self) -> bool {
        self.visible
    }

    /// Returns the complete filter used by nested navigation.
    pub fn active_filter(&self) -> Option<&SearchFilter> {
        self.active_filter.as_ref()
    }

    /// Returns whether nested navigation has an active complete filter.
    pub fn has_active_filter(&self) -> bool {
        self.active_filter.is_some()
    }

    /// Returns whether one nested request is awaiting its correlated response.
    pub fn is_pending(&self) -> bool {
        self.pending_request.is_some()
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
            pending_request: _,
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
            pending_request,
            status,
        } = self;
        *active_filter = None;
        *anchor = None;
        *pending_request = None;
        *status = NestedSearchStatus::Idle;
    }

    /// Dispatches one correlated nested request when navigation is ready.
    ///
    /// Returns `true` only when the command was enqueued. Returns `false` when no filter is
    /// active, another request is pending, or enqueueing fails; send failures clear pending state.
    pub fn request_match(
        &mut self,
        direction: IndexedNavigation,
        cmd_tx: &Sender<SessionCommand>,
        actions: &mut UiActions,
    ) -> bool {
        if self.pending_request.is_some() {
            return false;
        }

        let Some(filter) = self.active_filter().cloned() else {
            return false;
        };

        let request_id = Uuid::new_v4();
        let command = SessionCommand::FindNestedMatch {
            request_id,
            filter,
            search_result_anchor: self.anchor,
            direction,
        };
        self.pending_request = Some(request_id);
        self.status = NestedSearchStatus::Active;

        if actions.try_send_command(cmd_tx, command) {
            true
        } else {
            if self
                .pending_request
                .is_some_and(|pending| pending == request_id)
            {
                self.pending_request = None;
            }
            false
        }
    }

    /// Accepts and clears only the currently pending correlated response.
    pub fn accept_response(&mut self, request_id: Uuid) -> bool {
        if !self
            .pending_request
            .is_some_and(|pending| pending == request_id)
        {
            return false;
        }

        self.pending_request = None;
        true
    }

    /// Records that the current nested filter produced no result.
    pub fn set_no_match(&mut self) {
        self.status = NestedSearchStatus::NoMatch;
    }

    /// Records a successful nested match using its primary search-result coordinate.
    pub fn set_match(&mut self, search_result_index: u64) {
        self.anchor = Some(search_result_index);
        self.status = NestedSearchStatus::Active;
    }

    /// Aligns navigation with an explicitly selected primary search result.
    pub fn update_anchor(&mut self, search_result_index: u64) {
        if self.active_filter.is_some() {
            self.anchor = Some(search_result_index);
        }
    }
}

#[cfg(test)]
mod tests {
    use processor::search::filter::SearchFilter;
    use session_core::state::IndexedNavigation;
    use tokio::{runtime::Runtime, sync::mpsc};
    use uuid::Uuid;

    use super::{NestedSearchState, NestedSearchStatus};
    use crate::{
        common::validation::ValidationEligibility, host::ui::UiActions,
        session::command::SessionCommand,
    };

    fn complete_filter() -> SearchFilter {
        SearchFilter::plain("status=(ok|warn)")
            .regex(true)
            .ignore_case(true)
            .word(true)
    }

    fn actions() -> (Runtime, UiActions) {
        let runtime = Runtime::new().expect("runtime should initialize");
        let actions = UiActions::new(runtime.handle().clone());
        (runtime, actions)
    }

    fn receive_request(
        rx: &mut mpsc::Receiver<SessionCommand>,
    ) -> (Uuid, SearchFilter, Option<u64>, IndexedNavigation) {
        match rx.try_recv().expect("nested command should be sent") {
            SessionCommand::FindNestedMatch {
                request_id,
                filter,
                search_result_anchor,
                direction,
            } => (request_id, filter, search_result_anchor, direction),
            other => panic!("expected nested command, got {other:?}"),
        }
    }

    #[test]
    fn navigation_dispatches_filter_anchor_and_direction() {
        let (_runtime, mut actions) = actions();
        let (cmd_tx, mut cmd_rx) = mpsc::channel(4);
        let mut state = NestedSearchState::default();
        let filter = complete_filter();
        assert!(state.apply_filter(filter.clone()).is_eligible());

        assert!(state.request_match(IndexedNavigation::Next, &cmd_tx, &mut actions));
        let (request_id, sent_filter, anchor, direction) = receive_request(&mut cmd_rx);
        assert_eq!(sent_filter, filter);
        assert_eq!(anchor, None);
        assert_eq!(direction, IndexedNavigation::Next);
        assert!(state.is_pending());
        assert!(state.accept_response(request_id));

        state.set_match(7);
        assert!(state.request_match(IndexedNavigation::Previous, &cmd_tx, &mut actions));
        let (_, _, anchor, direction) = receive_request(&mut cmd_rx);
        assert_eq!(anchor, Some(7));
        assert_eq!(direction, IndexedNavigation::Previous);
    }

    #[test]
    fn changed_filter_clears_anchor_before_dispatch() {
        let (_runtime, mut actions) = actions();
        let (cmd_tx, mut cmd_rx) = mpsc::channel(2);
        let mut state = NestedSearchState::default();
        let filter = complete_filter();
        assert!(state.apply_filter(filter.clone()).is_eligible());
        state.set_match(7);

        let changed_filter = filter.ignore_case(false);
        assert!(state.apply_filter(changed_filter.clone()).is_eligible());
        assert!(state.request_match(IndexedNavigation::Next, &cmd_tx, &mut actions));

        let (_, sent_filter, anchor, _) = receive_request(&mut cmd_rx);
        assert_eq!(sent_filter, changed_filter);
        assert_eq!(anchor, None);
    }

    #[test]
    fn pending_request_prevents_overlap() {
        let (_runtime, mut actions) = actions();
        let (cmd_tx, mut cmd_rx) = mpsc::channel(2);
        let mut state = NestedSearchState::default();
        assert!(state.apply_filter(complete_filter()).is_eligible());

        assert!(state.request_match(IndexedNavigation::Next, &cmd_tx, &mut actions));
        assert!(!state.request_match(IndexedNavigation::Previous, &cmd_tx, &mut actions));

        let _ = receive_request(&mut cmd_rx);
        assert!(cmd_rx.try_recv().is_err());
    }

    #[test]
    fn send_failure_rolls_back_pending() {
        let (_runtime, mut actions) = actions();
        let mut state = NestedSearchState::default();
        assert!(state.apply_filter(complete_filter()).is_eligible());

        let (full_tx, _full_rx) = mpsc::channel(1);
        full_tx
            .try_send(SessionCommand::DropSearch { operation_id: None })
            .expect("channel should accept filler");
        assert!(!state.request_match(IndexedNavigation::Next, &full_tx, &mut actions));
        assert!(!state.is_pending());

        let (closed_tx, closed_rx) = mpsc::channel(1);
        drop(closed_rx);
        assert!(!state.request_match(IndexedNavigation::Next, &closed_tx, &mut actions));
        assert!(!state.is_pending());
    }

    #[test]
    fn only_matching_response_clears_pending() {
        let (_runtime, mut actions) = actions();
        let (cmd_tx, mut cmd_rx) = mpsc::channel(1);
        let mut state = NestedSearchState::default();
        assert!(state.apply_filter(complete_filter()).is_eligible());
        state.set_match(9);
        state.set_no_match();
        assert!(state.request_match(IndexedNavigation::Next, &cmd_tx, &mut actions));
        let expected_before_stale = state.clone();

        assert!(!state.accept_response(Uuid::new_v4()));
        assert_eq!(state, expected_before_stale);

        let (request_id, _, _, _) = receive_request(&mut cmd_rx);
        assert!(state.accept_response(request_id));
        assert!(!state.is_pending());
    }

    #[test]
    fn close_and_clear_filter_invalidate_pending() {
        let (_runtime, mut actions) = actions();
        let (cmd_tx, mut cmd_rx) = mpsc::channel(2);
        let mut state = NestedSearchState::default();
        state.open();
        assert!(state.apply_filter(complete_filter()).is_eligible());
        assert!(state.request_match(IndexedNavigation::Next, &cmd_tx, &mut actions));
        let (first_request, _, _, _) = receive_request(&mut cmd_rx);

        state.clear_filter();
        assert!(!state.accept_response(first_request));
        assert!(state.is_visible());
        assert_eq!(state.status, NestedSearchStatus::Idle);

        assert!(state.apply_filter(complete_filter()).is_eligible());
        assert!(state.request_match(IndexedNavigation::Next, &cmd_tx, &mut actions));
        let (second_request, _, _, _) = receive_request(&mut cmd_rx);
        state.close();
        assert!(!state.accept_response(second_request));
        assert_eq!(state, NestedSearchState::default());
    }

    #[test]
    fn result_transitions_preserve_or_replace_anchor() {
        let mut state = NestedSearchState::default();
        assert!(state.apply_filter(complete_filter()).is_eligible());
        state.set_match(7);

        state.set_no_match();
        assert_eq!(state.anchor, Some(7));
        assert_eq!(state.status, NestedSearchStatus::NoMatch);

        state.set_match(11);
        assert_eq!(state.anchor, Some(11));
        assert_eq!(state.status, NestedSearchStatus::Active);
    }

    #[test]
    fn invalid_regex_preserves_complete_request_state() {
        let (_runtime, mut actions) = actions();
        let (cmd_tx, _cmd_rx) = mpsc::channel(1);
        let mut state = NestedSearchState::default();
        let filter = complete_filter();
        assert!(state.apply_filter(filter).is_eligible());
        state.set_match(7);
        state.set_no_match();
        assert!(state.request_match(IndexedNavigation::Next, &cmd_tx, &mut actions));
        let expected = state.clone();

        let eligibility = state.apply_filter(SearchFilter::plain("(").regex(true));

        assert!(matches!(
            eligibility,
            ValidationEligibility::Ineligible { .. }
        ));
        assert_eq!(state, expected);
    }
}
