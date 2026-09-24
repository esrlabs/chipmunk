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

/// Narrows the global row selection to the rows one table's actions operate on.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SelectionScope {
    /// Every selected stream row.
    AllSelected,
    /// Selected rows that belong to the search table's logical contents.
    SearchRows,
}

impl SelectionScope {
    /// Iterates over the selected stream rows inside this scope.
    pub fn rows(self, shared: &SessionShared) -> impl Iterator<Item = u64> + '_ {
        shared.logs.selected_rows().filter(move |&row| match self {
            Self::AllSelected => true,
            Self::SearchRows => shared.search.has_match(row) || shared.logs.is_bookmarked(row),
        })
    }

    /// Returns how many selected rows fall inside this scope.
    pub fn count(self, shared: &SessionShared) -> usize {
        match self {
            Self::AllSelected => shared.logs.selected_count(),
            Self::SearchRows => self.rows(shared).count(),
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

    #[test]
    fn search_scope_includes_matches_and_bookmarks_only() {
        let shared = shared_with_selection();

        let mut rows = SelectionScope::SearchRows.rows(&shared).collect::<Vec<_>>();
        rows.sort_unstable();

        assert_eq!(rows, vec![10, 20, 30]);
        assert_eq!(SelectionScope::SearchRows.count(&shared), 3);
    }

    #[test]
    fn all_selected_scope_keeps_whole_selection() {
        let shared = shared_with_selection();

        let mut rows = SelectionScope::AllSelected
            .rows(&shared)
            .collect::<Vec<_>>();
        rows.sort_unstable();

        assert_eq!(rows, vec![10, 20, 30, 40]);
        assert_eq!(SelectionScope::AllSelected.count(&shared), 4);
    }
}
