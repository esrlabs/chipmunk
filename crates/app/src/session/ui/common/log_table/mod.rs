//! Shared log-table infrastructure.

use crate::session::ui::shared::SessionShared;

pub mod copy;
pub mod table;
pub mod text;

/// Identifies one of the session log-table views.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LogTableKind {
    /// Main logs output table.
    Main,
    /// Search results table.
    Search,
}

/// Identifies the log table whose logical contents an action operates on.
///
/// The row selection is global, so actions started from one table must narrow it to the rows
/// that table actually shows.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SelectionScope {
    /// The main logs table, which contains every stream row.
    MainTable,
    /// The search results table, which contains search matches and bookmarked rows.
    SearchResults,
}

impl SelectionScope {
    /// Iterates over the selected stream rows inside this scope.
    pub fn rows(self, shared: &SessionShared) -> impl Iterator<Item = u64> + '_ {
        shared.logs.selected_rows().filter(move |&row| match self {
            Self::MainTable => true,
            Self::SearchResults => shared.search.has_match(row) || shared.logs.is_bookmarked(row),
        })
    }

    /// Returns how many selected rows fall inside this scope.
    pub fn count(self, shared: &SessionShared) -> usize {
        match self {
            Self::MainTable => shared.logs.selected_count(),
            Self::SearchResults => self.rows(shared).count(),
        }
    }

    /// Returns how many rows this table contains in total.
    pub fn total_count(self, shared: &SessionShared) -> usize {
        match self {
            Self::MainTable => shared.logs.logs_count() as usize,
            // Bookmarks are user-created and few, so correcting the overlap per frame is cheap.
            Self::SearchResults => {
                let extra_bookmarks = shared
                    .logs
                    .bookmarked_rows
                    .iter()
                    .filter(|row| !shared.search.has_match(**row))
                    .count();

                shared.search.matches_count() + extra_bookmarks
            }
        }
    }

    /// Replaces the selection with every row this table contains.
    ///
    /// This reports no [`SelectionChange`](crate::session::ui::shared::SelectionChange): selecting
    /// a whole table must not load details or realign the peer table.
    pub fn select_all(self, shared: &mut SessionShared) {
        match self {
            Self::MainTable => {
                let logs_count = shared.logs.logs_count();
                shared.logs.select_rows(0..logs_count);
            }
            Self::SearchResults => {
                // Bookmarks live in `LogsState`, which is borrowed mutably below.
                let bookmarks: Vec<u64> = shared.logs.bookmarked_rows.iter().copied().collect();
                shared
                    .logs
                    .select_rows(shared.search.match_positions().chain(bookmarks));
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use std::path::PathBuf;

    use stypes::{FileFormat, FilterMatch, ObserveOrigin};
    use uuid::Uuid;

    use super::SelectionScope;
    use crate::{
        host::common::parsers::ParserNames,
        session::{
            types::ObserveOperation,
            ui::{SessionInfo, definitions::schema::LogSchemaSpec, shared::SessionShared},
        },
    };

    fn shared() -> SessionShared {
        let origin = ObserveOrigin::File(
            "source".to_owned(),
            FileFormat::Text,
            PathBuf::from("source.log"),
        );
        let observe_op = ObserveOperation::new(Uuid::new_v4(), origin);
        let session_info = SessionInfo {
            id: Uuid::new_v4(),
            title: "test".to_owned(),
            parser: ParserNames::Text,
            raw_export_supported: false,
        };

        SessionShared::new(session_info, observe_op, LogSchemaSpec::Text)
    }

    fn shared_with_selection() -> SessionShared {
        let mut shared = shared();
        shared.logs.replace_selection_with_rows(&[10, 20, 30, 40]);
        shared.insert_bookmark(20);
        shared.insert_bookmark(30);
        shared.search.set_search_operation(Uuid::new_v4());
        shared.search.append_matches(vec![
            FilterMatch {
                index: 10,
                filters: vec![0],
            },
            FilterMatch {
                index: 30,
                filters: vec![0],
            },
        ]);

        shared
    }

    fn sorted_selection(shared: &SessionShared) -> Vec<u64> {
        let mut rows = shared.logs.selected_rows().collect::<Vec<_>>();
        rows.sort_unstable();

        rows
    }

    #[test]
    fn search_scope_includes_matches_and_bookmarks_only() {
        let shared = shared_with_selection();

        let mut rows = SelectionScope::SearchResults
            .rows(&shared)
            .collect::<Vec<_>>();
        rows.sort_unstable();

        assert_eq!(rows, vec![10, 20, 30]);
        assert_eq!(SelectionScope::SearchResults.count(&shared), 3);
    }

    #[test]
    fn main_table_scope_keeps_whole_selection() {
        let shared = shared_with_selection();

        let mut rows = SelectionScope::MainTable.rows(&shared).collect::<Vec<_>>();
        rows.sort_unstable();

        assert_eq!(rows, vec![10, 20, 30, 40]);
        assert_eq!(SelectionScope::MainTable.count(&shared), 4);
    }

    #[test]
    fn main_table_select_all_replaces_selection_with_every_stream_row() {
        let mut shared = shared_with_selection();
        shared.logs.set_logs_count(5);

        assert_eq!(SelectionScope::MainTable.total_count(&shared), 5);

        SelectionScope::MainTable.select_all(&mut shared);

        assert_eq!(sorted_selection(&shared), vec![0, 1, 2, 3, 4]);
    }

    #[test]
    fn search_results_select_all_takes_matches_and_bookmarks_only() {
        let mut shared = shared_with_selection();
        shared.logs.set_logs_count(50);

        // Row 30 is both a match and a bookmark, so the overlap must not be counted twice.
        assert_eq!(SelectionScope::SearchResults.total_count(&shared), 3);

        SelectionScope::SearchResults.select_all(&mut shared);

        assert_eq!(sorted_selection(&shared), vec![10, 20, 30]);
    }
}
