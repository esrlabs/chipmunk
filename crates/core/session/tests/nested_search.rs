//! Public nested-search API contract tests.

use std::sync::Arc;

use processor::search::filter::SearchFilter;
use session::{
    session::Session,
    state::{IndexedNavigation, NestedMatch},
    temp_dir::InstanceTempDir,
};
use uuid::Uuid;

#[tokio::test]
async fn public_api_returns_named_nested_coordinates() {
    let content = [
        "zero",
        "primary one",
        "bookmark two",
        "primary three",
        "bookmark four",
        "final target",
    ]
    .iter()
    .map(|line| format!("{line}\n"))
    .collect();

    let session_id = Uuid::new_v4();
    // Session files go to a throwaway instance directory instead of the user's Chipmunk home.
    let streams_dir = tempfile::tempdir().unwrap();
    let temp_dir = Arc::new(InstanceTempDir::claim(streams_dir.path()));
    let (session, _events) = Session::new(session_id, temp_dir).await.unwrap();
    session.state.create_session_file().await.unwrap();
    session.state.write_session_file(0, content).await.unwrap();
    session.state.flush_session_file().await.unwrap();
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
