//! Public nested-search API contract tests.

use std::io::Write;

use processor::search::filter::SearchFilter;
use session::{
    session::Session,
    state::{IndexedNavigation, NestedMatch},
};
use tempfile::NamedTempFile;
use uuid::Uuid;

#[tokio::test]
async fn public_api_returns_named_nested_coordinates() {
    let mut file = NamedTempFile::new().unwrap();
    for line in [
        "zero",
        "primary one",
        "bookmark two",
        "primary three",
        "bookmark four",
        "final target",
    ] {
        writeln!(file, "{line}").unwrap();
    }
    file.flush().unwrap();

    let session_id = Uuid::new_v4();
    let (session, _events) = Session::new(session_id).await.unwrap();
    let session_path = file.path().to_path_buf();
    session
        .state
        .set_session_file(Some(session_path))
        .await
        .unwrap();
    session.state.update_session(0).await.unwrap();
    let matches = [1, 3, 5]
        .into_iter()
        .map(|row| stypes::FilterMatch::new(row, vec![]))
        .collect();
    session
        .state
        .set_matches(Some(matches), None)
        .await
        .unwrap();
    session.set_bookmarks(vec![2, 4]).await.unwrap();

    let filter = SearchFilter::plain("target");
    let found = session
        .search_nested_match(filter, None, IndexedNavigation::Next)
        .await
        .unwrap();

    assert_eq!(
        found,
        Some(NestedMatch {
            session_position: 5,
            search_result_index: 2,
            indexed_row_index: 4,
        })
    );

    let stop_id = Uuid::new_v4();
    session.stop(stop_id).await.unwrap();
}
