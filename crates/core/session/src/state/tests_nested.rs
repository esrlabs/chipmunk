//! Nested-search state contract tests.

use processor::search::filter::SearchFilter;
use tokio::sync::mpsc::{channel, unbounded_channel};
use tokio_util::sync::CancellationToken;

use super::{IndexedNavigation, NestedMatch, SessionState};

struct Fixture {
    state: SessionState,
}

impl Fixture {
    /// Fills the session file of a fresh state with `lines`, which is how every source feeds
    /// content into a session. `SessionState::drop` removes the file again.
    fn new(lines: &[&str]) -> Self {
        let (callback_tx, _callback_rx) = unbounded_channel();
        let (search_tx, _search_rx) = channel(1);
        let mut state = SessionState::new(callback_tx, search_tx);
        state.session_file.init().unwrap();
        let content = lines.iter().map(|line| format!("{line}\n")).collect();
        state
            .session_file
            .write(0, CancellationToken::new(), content)
            .unwrap();
        state
            .session_file
            .flush(CancellationToken::new(), true)
            .unwrap();

        Self { state }
    }

    fn set_primary(&mut self, rows: &[u64]) {
        let matches = filter_matches(rows);
        self.state.indexes.set_search_results(&matches);
        self.state.search_map.set(Some(matches), None);
    }

    fn find(
        &mut self,
        value: &str,
        anchor: Option<u64>,
        direction: IndexedNavigation,
    ) -> Option<NestedMatch> {
        let filter = SearchFilter::plain(value);
        self.state
            .handle_search_nested_match(filter, anchor, direction)
            .unwrap()
    }
}

fn filter_matches(rows: &[u64]) -> Vec<stypes::FilterMatch> {
    rows.iter()
        .map(|row| stypes::FilterMatch::new(*row, vec![]))
        .collect()
}

#[test]
fn unanchored_navigation_starts_at_requested_boundary() {
    let mut fixture = Fixture::new(&["first target", "middle", "last target"]);
    fixture.set_primary(&[0, 1, 2]);

    assert_eq!(
        fixture.find("target", None, IndexedNavigation::Next),
        Some(NestedMatch {
            session_position: 0,
            search_result_index: 0,
            indexed_row_index: 0,
        })
    );
    assert_eq!(
        fixture.find("target", None, IndexedNavigation::Previous),
        Some(NestedMatch {
            session_position: 2,
            search_result_index: 2,
            indexed_row_index: 2,
        })
    );
}

#[test]
fn anchored_navigation_excludes_anchor_and_wraps() {
    let mut fixture = Fixture::new(&["first wrap", "near side", "anchor only", "last side wrap"]);
    fixture.set_primary(&[0, 1, 2, 3]);

    assert_eq!(
        fixture
            .find("side", Some(0), IndexedNavigation::Next)
            .map(|found| found.search_result_index),
        Some(1)
    );
    assert_eq!(
        fixture
            .find("side", Some(3), IndexedNavigation::Previous)
            .map(|found| found.search_result_index),
        Some(1)
    );
    assert_eq!(
        fixture
            .find("first", Some(3), IndexedNavigation::Next)
            .map(|found| found.search_result_index),
        Some(0)
    );
    assert_eq!(
        fixture
            .find("last", Some(0), IndexedNavigation::Previous)
            .map(|found| found.search_result_index),
        Some(3)
    );
    assert_eq!(
        fixture.find("anchor", Some(2), IndexedNavigation::Next),
        None
    );
    assert_eq!(
        fixture.find("anchor", Some(2), IndexedNavigation::Previous),
        None
    );
}

#[test]
fn empty_no_match_and_stale_anchor_are_non_failing() {
    let mut empty = Fixture::new(&["target"]);
    assert_eq!(empty.find("target", None, IndexedNavigation::Next), None);
    assert_eq!(
        empty.find("target", None, IndexedNavigation::Previous),
        None
    );

    let mut fixture = Fixture::new(&["first target", "middle", "last target"]);
    fixture.set_primary(&[0, 1, 2]);
    assert_eq!(
        fixture
            .find("target", Some(u64::MAX), IndexedNavigation::Next)
            .map(|found| found.search_result_index),
        Some(0)
    );
    assert_eq!(
        fixture
            .find("target", Some(u64::MAX), IndexedNavigation::Previous)
            .map(|found| found.search_result_index),
        Some(2)
    );
    assert_eq!(
        fixture.find("missing", Some(1), IndexedNavigation::Next),
        None
    );
}

#[test]
fn result_reports_exact_primary_and_indexed_coordinates() {
    let mut fixture = Fixture::new(&[
        "zero",
        "primary one",
        "bookmark two",
        "overlap target",
        "bookmark four",
        "primary five",
        "six",
        "final target",
    ]);
    fixture.set_primary(&[1, 3, 5, 7]);
    fixture.state.indexes.set_bookmarks(vec![2, 3, 4]);

    assert_eq!(
        fixture.find("final", None, IndexedNavigation::Next),
        Some(NestedMatch {
            session_position: 7,
            search_result_index: 3,
            indexed_row_index: 5,
        })
    );
    assert_eq!(
        fixture.find("overlap", None, IndexedNavigation::Next),
        Some(NestedMatch {
            session_position: 3,
            search_result_index: 1,
            indexed_row_index: 2,
        })
    );
}

#[test]
fn missing_indexed_row_returns_error() {
    let mut fixture = Fixture::new(&["zero", "target"]);
    let matches = filter_matches(&[1]);
    fixture.state.search_map.set(Some(matches), None);

    let filter = SearchFilter::plain("target");
    assert!(
        fixture
            .state
            .handle_search_nested_match(filter, None, IndexedNavigation::Next)
            .is_err()
    );
}
