use tokio::sync::mpsc::{UnboundedReceiver, unbounded_channel};

use super::{IndexedNavigation, controller::Controller, nature::Nature};

fn filter_matches(rows: impl IntoIterator<Item = u64>) -> Vec<stypes::FilterMatch> {
    rows.into_iter()
        .map(|index| stypes::FilterMatch {
            index,
            filters: vec![],
        })
        .collect()
}

fn overlap() -> Nature {
    let mut nature = Nature::SEARCH;
    nature.include(Nature::BOOKMARK);
    nature
}

fn indexed_rows(controller: &mut Controller) -> Vec<(u64, Nature)> {
    let len = controller.len();
    if len == 0 {
        return vec![];
    }

    controller
        .frame(&mut (0..=(len as u64 - 1)))
        .unwrap()
        .indexes
}

fn next_len(rx: &mut UnboundedReceiver<stypes::CallbackEvent>) -> u64 {
    match rx.try_recv().unwrap() {
        stypes::CallbackEvent::IndexedMapUpdated { len } => len,
        event => panic!("unexpected callback: {event:?}"),
    }
}

#[test]
fn search_projection_is_ordered_by_session_position() {
    let mut controller = Controller::default();

    controller.set_search_results(&filter_matches([12, 2, 7]));

    assert_eq!(
        indexed_rows(&mut controller),
        vec![
            (2, Nature::SEARCH),
            (7, Nature::SEARCH),
            (12, Nature::SEARCH),
        ]
    );
}

#[test]
fn bookmark_projection_is_ordered_by_session_position() {
    let mut controller = Controller::default();

    controller.set_bookmarks(vec![8, 2]);
    controller.set_bookmarks(vec![5]);

    assert_eq!(
        indexed_rows(&mut controller),
        vec![
            (2, Nature::BOOKMARK),
            (5, Nature::BOOKMARK),
            (8, Nature::BOOKMARK),
        ]
    );
}

#[test]
fn search_and_bookmark_rows_form_an_ordered_union_with_overlap() {
    let mut controller = Controller::default();
    controller.set_search_results(&filter_matches([9, 3]));

    controller.set_bookmarks(vec![7, 9]);

    assert_eq!(
        indexed_rows(&mut controller),
        vec![(3, Nature::SEARCH), (7, Nature::BOOKMARK), (9, overlap()),]
    );
}

#[test]
fn dropping_search_preserves_bookmarks_and_overlap_rows() {
    let mut controller = Controller::default();
    controller.set_search_results(&filter_matches([1, 2, 5]));
    controller.set_bookmarks(vec![2, 3]);

    controller.drop_search();

    assert_eq!(
        indexed_rows(&mut controller),
        vec![(2, Nature::BOOKMARK), (3, Nature::BOOKMARK)]
    );
}

#[test]
fn removing_bookmark_preserves_search_membership_at_overlap() {
    let mut controller = Controller::default();
    controller.set_search_results(&filter_matches([4]));
    controller.set_bookmarks(vec![4, 8]);

    controller.remove_bookmark(4);

    assert_eq!(
        indexed_rows(&mut controller),
        vec![(4, Nature::SEARCH), (8, Nature::BOOKMARK)]
    );
}

#[test]
fn search_results_can_be_replaced_and_appended_without_losing_bookmarks() {
    let mut controller = Controller::default();
    controller.set_search_results(&filter_matches([1, 3]));
    controller.set_bookmarks(vec![3, 9]);

    controller.set_search_results(&filter_matches([5, 3]));
    controller.append_search_results(&filter_matches([7, 5]));

    assert_eq!(
        indexed_rows(&mut controller),
        vec![
            (3, overlap()),
            (5, Nature::SEARCH),
            (7, Nature::SEARCH),
            (9, Nature::BOOKMARK),
        ]
    );
}

#[test]
fn nearest_indexed_row_resolves_search_only_rows() {
    let mut controller = Controller::default();
    controller.set_search_results(&filter_matches([10, 30, 50]));

    assert_eq!(controller.nearest_indexed_row(34).unwrap(), Some(1));
}

#[test]
fn nearest_indexed_row_resolves_bookmark_only_rows() {
    let mut controller = Controller::default();
    controller.set_bookmarks(vec![20, 40]);

    assert_eq!(controller.nearest_indexed_row(34).unwrap(), Some(1));
}

#[test]
fn nearest_indexed_row_uses_interleaved_union_coordinates() {
    let mut controller = Controller::default();
    controller.set_search_results(&filter_matches([10, 30, 50]));
    controller.set_bookmarks(vec![20, 40]);

    assert_eq!(controller.nearest_indexed_row(34).unwrap(), Some(2));
    assert_eq!(controller.nearest_indexed_row(35).unwrap(), Some(2));
    assert_eq!(controller.nearest_indexed_row(40).unwrap(), Some(3));
}

#[test]
fn nearest_indexed_row_counts_overlap_once() {
    let mut controller = Controller::default();
    controller.set_search_results(&filter_matches([10, 30, 50]));
    controller.set_bookmarks(vec![20, 30, 40]);

    assert_eq!(controller.len(), 5);
    assert_eq!(controller.nearest_indexed_row(30).unwrap(), Some(2));
    assert_eq!(controller.nearest_indexed_row(35).unwrap(), Some(2));
}

#[test]
fn nearest_indexed_row_remains_correct_after_dropping_search() {
    let mut controller = Controller::default();
    controller.set_search_results(&filter_matches([10, 30, 50]));
    controller.set_bookmarks(vec![20, 30, 40]);

    controller.drop_search();

    assert_eq!(controller.nearest_indexed_row(34).unwrap(), Some(1));
    assert_eq!(controller.nearest_indexed_row(40).unwrap(), Some(2));
}

#[test]
fn nearest_indexed_row_preserves_search_after_removing_overlap_bookmark() {
    let mut controller = Controller::default();
    controller.set_search_results(&filter_matches([10, 30, 50]));
    controller.set_bookmarks(vec![20, 30, 40]);

    controller.remove_bookmark(30);

    assert_eq!(controller.nearest_indexed_row(30).unwrap(), Some(2));
    assert_eq!(controller.nearest_indexed_row(35).unwrap(), Some(2));
}

#[test]
fn callback_lengths_follow_search_and_bookmark_membership_changes() {
    let (tx, mut rx) = unbounded_channel();
    let mut controller = Controller::new(Some(tx));

    controller.set_search_results(&filter_matches([2, 4]));
    controller.add_bookmark(4);
    controller.add_bookmark(9);
    controller.drop_search();
    controller.remove_bookmark(4);

    assert_eq!(next_len(&mut rx), 2);
    assert_eq!(next_len(&mut rx), 2);
    assert_eq!(next_len(&mut rx), 3);
    assert_eq!(next_len(&mut rx), 2);
    assert_eq!(next_len(&mut rx), 1);
    assert!(rx.try_recv().is_err());
}

#[test]
fn zero_length_stream_clears_all_indexed_rows() {
    let (tx, mut rx) = unbounded_channel();
    let mut controller = Controller::new(Some(tx));
    controller.set_search_results(&filter_matches([1, 6]));
    controller.set_bookmarks(vec![3, 6]);
    assert_eq!(next_len(&mut rx), 2);
    assert_eq!(next_len(&mut rx), 3);

    controller.set_stream_len(100);
    assert_eq!(controller.len(), 3);
    assert_eq!(next_len(&mut rx), 3);

    controller.set_stream_len(0);

    assert_eq!(controller.len(), 0);
    assert!(indexed_rows(&mut controller).is_empty());
    assert_eq!(next_len(&mut rx), 0);
}

#[test]
fn indexed_neighbor_wraps_over_search_and_bookmark_union() {
    let mut controller = Controller::default();
    controller.set_search_results(&filter_matches([2, 9]));
    controller.set_bookmarks(vec![5, 9]);

    assert_eq!(
        controller.indexed_neighbor(None, IndexedNavigation::Next),
        Some(2)
    );
    assert_eq!(
        controller.indexed_neighbor(Some(2), IndexedNavigation::Next),
        Some(5)
    );
    assert_eq!(
        controller.indexed_neighbor(Some(9), IndexedNavigation::Next),
        Some(2)
    );
    assert_eq!(
        controller.indexed_neighbor(Some(2), IndexedNavigation::Previous),
        Some(9)
    );
}
