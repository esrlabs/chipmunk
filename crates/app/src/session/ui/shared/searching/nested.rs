//! Session state for Find in Search Results.

use std::time::{Duration, Instant};

use processor::search::filter::SearchFilter;
use regex::Regex;
use session_core::state::IndexedNavigation;
use tokio::sync::mpsc::Sender;
use uuid::Uuid;

use crate::{
    common::validation::{ValidationEligibility, validate_filter},
    host::ui::UiActions,
    session::command::{FindNestedMatchParams, SessionCommand},
};

/// Canonical state tied to the current primary search lifecycle.
#[derive(Debug, Default)]
pub struct NestedSearchState {
    open: bool,
    active_filter: Option<SearchFilter>,
    matcher: Option<Box<Regex>>,
    anchor: Option<u64>,
    pending_request: Option<PendingRequest>,
}

#[derive(Debug)]
struct PendingRequest {
    id: Uuid,
    started_at: Instant,
}

impl NestedSearchState {
    /// Returns whether the nested-search shell is logically open.
    pub fn is_open(&self) -> bool {
        self.open
    }

    /// Returns the complete filter used by nested navigation.
    pub fn active_filter(&self) -> Option<&SearchFilter> {
        self.active_filter.as_ref()
    }

    /// Returns whether nested navigation has an active complete filter.
    pub fn has_active_filter(&self) -> bool {
        self.active_filter.is_some()
    }

    /// Returns the cached matcher used for displayed-cell highlighting.
    pub fn matcher(&self) -> Option<&Regex> {
        self.matcher.as_deref()
    }

    /// Returns whether one nested request is awaiting its correlated response.
    pub fn is_pending(&self) -> bool {
        self.pending_request.is_some()
    }

    /// Returns the delay remaining before pending progress should be shown.
    pub fn progress_remaining(&self, now: Instant) -> Option<Duration> {
        const PROGRESS_DELAY: Duration = Duration::from_millis(250);

        let started_at = self.pending_request.as_ref()?.started_at;
        let elapsed = now.saturating_duration_since(started_at);
        Some(PROGRESS_DELAY.saturating_sub(elapsed))
    }

    /// Opens nested search without changing its active filter.
    pub fn open(&mut self) {
        self.open = true;
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
            open: _,
            active_filter,
            matcher,
            anchor,
            pending_request,
        } = self;
        if active_filter.as_ref() != Some(&filter) {
            *active_filter = Some(filter);
            *matcher = None;
            *anchor = None;
            *pending_request = None;
        }

        eligibility
    }

    /// Drops the active filter while keeping the widget open.
    pub fn clear_filter(&mut self) {
        let Self {
            open: _,
            active_filter,
            matcher,
            anchor,
            pending_request,
        } = self;
        *active_filter = None;
        *matcher = None;
        *anchor = None;
        *pending_request = None;
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
        let params = FindNestedMatchParams {
            request_id,
            filter,
            search_result_anchor: self.anchor,
            direction,
            include_matcher: self.matcher.is_none(),
        };
        let command = SessionCommand::FindNestedMatch(Box::new(params));
        self.pending_request = Some(PendingRequest {
            id: request_id,
            started_at: Instant::now(),
        });

        if actions.try_send_command(cmd_tx, command) {
            true
        } else {
            if self
                .pending_request
                .as_ref()
                .is_some_and(|pending| pending.id == request_id)
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
            .as_ref()
            .is_some_and(|pending| pending.id == request_id)
        {
            return false;
        }

        self.pending_request = None;
        true
    }

    /// Sets the cached matcher used for displayed-cell highlighting.
    pub fn set_matcher(&mut self, matcher: Box<Regex>) {
        self.matcher = Some(matcher);
    }

    /// Records a successful nested match using its primary search-result coordinate.
    pub fn set_match(&mut self, search_result_index: u64) {
        self.anchor = Some(search_result_index);
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
    use std::time::{Duration, Instant};

    use processor::search::filter::SearchFilter;
    use regex::Regex;
    use session_core::state::IndexedNavigation;
    use tokio::{runtime::Runtime, sync::mpsc};
    use uuid::Uuid;

    use super::NestedSearchState;
    use crate::{
        common::validation::ValidationEligibility,
        host::ui::UiActions,
        session::command::{FindNestedMatchParams, SessionCommand},
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

    fn receive_request(rx: &mut mpsc::Receiver<SessionCommand>) -> FindNestedMatchParams {
        match rx.try_recv().expect("nested command should be sent") {
            SessionCommand::FindNestedMatch(params) => *params,
            other => panic!("expected nested command, got {other:?}"),
        }
    }

    fn set_matcher(state: &mut NestedSearchState) {
        state.set_matcher(Box::new(Regex::new("status=(ok|warn)").unwrap()));
    }

    #[test]
    fn navigation_requests_matcher_until_one_is_set() {
        let (_runtime, mut actions) = actions();
        let (cmd_tx, mut cmd_rx) = mpsc::channel(4);
        let mut state = NestedSearchState::default();
        let filter = complete_filter();
        assert!(state.apply_filter(filter.clone()).is_eligible());

        assert!(state.request_match(IndexedNavigation::Next, &cmd_tx, &mut actions));
        let request = receive_request(&mut cmd_rx);
        assert_eq!(request.filter, filter);
        assert_eq!(request.search_result_anchor, None);
        assert_eq!(request.direction, IndexedNavigation::Next);
        assert!(request.include_matcher);
        assert!(state.accept_response(request.request_id));

        set_matcher(&mut state);
        state.set_match(7);
        assert!(state.request_match(IndexedNavigation::Previous, &cmd_tx, &mut actions));
        let request = receive_request(&mut cmd_rx);
        assert_eq!(request.search_result_anchor, Some(7));
        assert_eq!(request.direction, IndexedNavigation::Previous);
        assert!(!request.include_matcher);
    }

    #[test]
    fn changed_filter_clears_matcher_anchor_and_pending_request() {
        let (_runtime, mut actions) = actions();
        let (cmd_tx, mut cmd_rx) = mpsc::channel(2);
        let mut state = NestedSearchState::default();
        let filter = complete_filter();
        assert!(state.apply_filter(filter.clone()).is_eligible());
        set_matcher(&mut state);
        state.set_match(7);
        assert!(state.request_match(IndexedNavigation::Next, &cmd_tx, &mut actions));
        let stale_request = receive_request(&mut cmd_rx).request_id;

        let changed_filter = filter.ignore_case(false);
        assert!(state.apply_filter(changed_filter.clone()).is_eligible());

        assert!(state.matcher().is_none());
        assert!(!state.is_pending());
        assert!(state.progress_remaining(Instant::now()).is_none());
        assert!(!state.accept_response(stale_request));
        assert!(state.request_match(IndexedNavigation::Next, &cmd_tx, &mut actions));
        let request = receive_request(&mut cmd_rx);
        assert_eq!(request.filter, changed_filter);
        assert_eq!(request.search_result_anchor, None);
        assert!(request.include_matcher);
    }

    #[test]
    fn same_filter_preserves_matcher_anchor_and_pending_request() {
        let (_runtime, mut actions) = actions();
        let (cmd_tx, mut cmd_rx) = mpsc::channel(2);
        let mut state = NestedSearchState::default();
        let filter = complete_filter();
        assert!(state.apply_filter(filter.clone()).is_eligible());
        set_matcher(&mut state);
        state.set_match(9);
        assert!(state.request_match(IndexedNavigation::Next, &cmd_tx, &mut actions));
        let request_id = receive_request(&mut cmd_rx).request_id;

        assert!(state.apply_filter(filter).is_eligible());

        assert!(state.matcher().is_some());
        assert!(state.is_pending());
        assert_eq!(state.anchor, Some(9));
        assert!(state.accept_response(request_id));
    }

    #[test]
    fn failed_enqueue_retries_with_matcher_request() {
        let (_runtime, mut actions) = actions();
        let mut state = NestedSearchState::default();
        assert!(state.apply_filter(complete_filter()).is_eligible());

        let (full_tx, _full_rx) = mpsc::channel(1);
        full_tx
            .try_send(SessionCommand::DropSearch { operation_id: None })
            .expect("channel should accept filler");
        assert!(!state.request_match(IndexedNavigation::Next, &full_tx, &mut actions));
        assert!(!state.is_pending());
        assert!(state.progress_remaining(Instant::now()).is_none());
        assert!(state.matcher().is_none());

        let (retry_tx, mut retry_rx) = mpsc::channel(1);
        assert!(state.request_match(IndexedNavigation::Next, &retry_tx, &mut actions));
        assert!(receive_request(&mut retry_rx).include_matcher);
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
    fn progress_appears_after_delay() {
        let (_runtime, mut actions) = actions();
        let (cmd_tx, mut cmd_rx) = mpsc::channel(1);
        let mut state = NestedSearchState::default();
        assert!(state.apply_filter(complete_filter()).is_eligible());
        assert!(state.request_match(IndexedNavigation::Next, &cmd_tx, &mut actions));
        let _ = receive_request(&mut cmd_rx);
        let started_at = state
            .pending_request
            .as_ref()
            .expect("request should be pending")
            .started_at;

        assert_eq!(
            state.progress_remaining(started_at + Duration::from_millis(249)),
            Some(Duration::from_millis(1))
        );
        assert_eq!(
            state.progress_remaining(started_at + Duration::from_millis(250)),
            Some(Duration::ZERO)
        );
        assert_eq!(
            state.progress_remaining(started_at + Duration::from_secs(1)),
            Some(Duration::ZERO)
        );
    }

    #[test]
    fn stale_response_preserves_pending_state() {
        let (_runtime, mut actions) = actions();
        let (cmd_tx, mut cmd_rx) = mpsc::channel(1);
        let mut state = NestedSearchState::default();
        assert!(state.apply_filter(complete_filter()).is_eligible());
        set_matcher(&mut state);
        state.set_match(9);
        assert!(state.request_match(IndexedNavigation::Next, &cmd_tx, &mut actions));
        let request_id = receive_request(&mut cmd_rx).request_id;
        let started_at = state
            .pending_request
            .as_ref()
            .expect("request should be pending")
            .started_at;

        assert!(!state.accept_response(Uuid::new_v4()));
        assert!(state.is_pending());
        assert_eq!(
            state.progress_remaining(started_at + Duration::from_millis(100)),
            Some(Duration::from_millis(150))
        );
        assert!(state.matcher().is_some());
        assert_eq!(state.anchor, Some(9));

        assert!(state.accept_response(request_id));
        assert!(!state.is_pending());
        assert!(state.progress_remaining(Instant::now()).is_none());
    }

    #[test]
    fn clear_and_close_remove_matcher_and_invalidate_pending() {
        let (_runtime, mut actions) = actions();
        let (cmd_tx, mut cmd_rx) = mpsc::channel(2);
        let mut state = NestedSearchState::default();
        state.open();
        assert!(state.apply_filter(complete_filter()).is_eligible());
        set_matcher(&mut state);
        assert!(state.request_match(IndexedNavigation::Next, &cmd_tx, &mut actions));
        let first_request = receive_request(&mut cmd_rx).request_id;

        state.clear_filter();
        assert!(!state.accept_response(first_request));
        assert!(state.progress_remaining(Instant::now()).is_none());
        assert!(state.is_open());
        assert!(!state.has_active_filter());
        assert!(state.matcher().is_none());

        assert!(state.apply_filter(complete_filter()).is_eligible());
        set_matcher(&mut state);
        assert!(state.request_match(IndexedNavigation::Next, &cmd_tx, &mut actions));
        let second_request = receive_request(&mut cmd_rx).request_id;
        state.close();
        assert!(!state.accept_response(second_request));
        assert!(state.progress_remaining(Instant::now()).is_none());
        assert!(!state.is_open());
        assert!(!state.has_active_filter());
        assert!(state.matcher().is_none());
    }

    #[test]
    fn invalid_regex_preserves_complete_request_state() {
        let (_runtime, mut actions) = actions();
        let (cmd_tx, mut cmd_rx) = mpsc::channel(1);
        let mut state = NestedSearchState::default();
        let filter = complete_filter();
        assert!(state.apply_filter(filter.clone()).is_eligible());
        set_matcher(&mut state);
        state.set_match(7);
        assert!(state.request_match(IndexedNavigation::Next, &cmd_tx, &mut actions));
        let request_id = receive_request(&mut cmd_rx).request_id;

        let eligibility = state.apply_filter(SearchFilter::plain("(").regex(true));

        assert!(matches!(
            eligibility,
            ValidationEligibility::Ineligible { .. }
        ));
        assert_eq!(state.active_filter(), Some(&filter));
        assert!(state.matcher().is_some());
        assert_eq!(state.anchor, Some(7));
        assert_eq!(
            state.pending_request.as_ref().map(|pending| pending.id),
            Some(request_id)
        );
    }
}
