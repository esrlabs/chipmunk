//! Quick Open source matching and result list construction.

use std::sync::Arc;

use crate::{
    common::{matcher::substring_matcher::SubstringMatcher, ui::search_picker::SearchPickerText},
    host::ui::storage::{
        HostStorage,
        file_explorer::{FileTreeNode, FileTreeNodeKind},
        recent::session::RecentSessionSnapshot,
        types::LoadState,
    },
};

use super::{QuickOpenItem, RESULT_LIMIT};

/// Rebuilds the capped Quick Open result list from current host storage.
pub fn recompute_results(
    storage: &HostStorage,
    matcher: &mut SubstringMatcher,
) -> Vec<QuickOpenItem> {
    let mut results = Vec::with_capacity(RESULT_LIMIT);

    append_recent_results(storage, matcher, &mut results);
    if results.len() < RESULT_LIMIT {
        append_favorite_results(storage, matcher, &mut results);
    }

    results
}

fn append_recent_results(
    storage: &HostStorage,
    matcher: &mut SubstringMatcher,
    results: &mut Vec<QuickOpenItem>,
) {
    for session in &storage.recent_sessions.sessions {
        if results.len() >= RESULT_LIMIT {
            return;
        }

        if !matches_recent_session(matcher, session) {
            continue;
        }

        results.push(QuickOpenItem::RecentSession {
            source_key: Arc::clone(&session.source_key),
            title: matched_text(session.title().to_owned(), matcher),
            summary: matched_text(session.summary().to_owned(), matcher),
        });
    }
}

fn matched_text(text: String, matcher: &mut SubstringMatcher) -> SearchPickerText {
    let highlights = matcher.highlight_ranges(&text);
    SearchPickerText::new(text, highlights)
}

fn append_favorite_results(
    storage: &HostStorage,
    matcher: &mut SubstringMatcher,
    results: &mut Vec<QuickOpenItem>,
) {
    let LoadState::Ready(data) = &storage.file_explorer.state else {
        return;
    };

    for folder in &data.favorite_folders {
        if append_favorite_nodes(&folder.children, matcher, results) {
            return;
        }
    }
}

fn matches_recent_session(matcher: &mut SubstringMatcher, session: &RecentSessionSnapshot) -> bool {
    matcher.matches(session.title()) || matcher.matches(session.summary())
}

fn append_favorite_nodes(
    nodes: &[FileTreeNode],
    matcher: &mut SubstringMatcher,
    results: &mut Vec<QuickOpenItem>,
) -> bool {
    for node in nodes {
        match &node.kind {
            FileTreeNodeKind::Folder(children) => {
                if append_favorite_nodes(children, matcher, results) {
                    return true;
                }
            }
            FileTreeNodeKind::File => {
                let path_text = node.path.to_string_lossy().into_owned();
                if matcher.matches(node.name.as_str()) || matcher.matches(&path_text) {
                    results.push(QuickOpenItem::FavoriteFile {
                        path: node.path.clone(),
                        name: matched_text(node.name.clone(), matcher),
                        path_text: matched_text(path_text, matcher),
                    });

                    if results.len() >= RESULT_LIMIT {
                        return true;
                    }
                }
            }
        }
    }

    false
}

#[cfg(test)]
mod tests {
    use std::{ops::Range, path::PathBuf};

    use stypes::{FileFormat, ParserType};

    use super::recompute_results;
    use crate::{
        common::matcher::substring_matcher::SubstringMatcher,
        host::ui::{
            quick_open::{QuickOpenItem, RESULT_LIMIT},
            storage::{
                HostStorage,
                file_explorer::{FavoriteFolder, FileExplorerData, FileTreeNode, FileTreeNodeKind},
                recent::{
                    session::{RecentSessionSnapshot, RecentSessionSource},
                    storage::RecentSessionsStorage,
                },
                settings::AppSettings,
                types::LoadState,
            },
        },
    };

    fn storage(
        sessions: Vec<RecentSessionSnapshot>,
        favorite_folders: Vec<FavoriteFolder>,
    ) -> HostStorage {
        let (cmd_tx, _cmd_rx) = tokio::sync::mpsc::channel(1);
        let mut recent_sessions = RecentSessionsStorage::default();
        recent_sessions.sessions = sessions;
        let mut storage = HostStorage::new(cmd_tx, recent_sessions, AppSettings::default());
        storage.file_explorer.state = LoadState::Ready(FileExplorerData { favorite_folders });
        storage
    }

    fn recent(path: &str, parser: ParserType) -> RecentSessionSnapshot {
        RecentSessionSnapshot::new(
            1,
            vec![RecentSessionSource::File {
                format: FileFormat::Text,
                path: PathBuf::from(path),
            }],
            parser,
            Default::default(),
        )
    }

    fn file(path: &str, name: &str) -> FileTreeNode {
        FileTreeNode {
            path: PathBuf::from(path),
            name: name.into(),
            kind: FileTreeNodeKind::File,
        }
    }

    fn folder(path: &str, children: Vec<FileTreeNode>) -> FavoriteFolder {
        FavoriteFolder {
            path: PathBuf::from(path),
            children,
        }
    }

    fn build_matcher(query: &str) -> SubstringMatcher {
        let mut matcher = SubstringMatcher::default();
        matcher.build_query(query);
        matcher
    }

    fn result_names(results: &[QuickOpenItem]) -> Vec<&str> {
        results
            .iter()
            .map(|item| match item {
                QuickOpenItem::RecentSession { title, .. } => title.text.as_str(),
                QuickOpenItem::FavoriteFile { name, .. } => name.text.as_str(),
            })
            .collect()
    }

    #[test]
    fn empty_query_keeps_recent_then_favorites_order() {
        let storage = storage(
            vec![
                recent("/logs/first.log", ParserType::Text(())),
                recent("/logs/second.log", ParserType::Text(())),
            ],
            vec![folder(
                "/fav",
                vec![file("/fav/a.log", "a.log"), file("/fav/b.log", "b.log")],
            )],
        );
        let mut matcher = build_matcher("");

        let results = recompute_results(&storage, &mut matcher);

        assert_eq!(
            result_names(&results),
            vec!["first.log", "second.log", "a.log", "b.log"]
        );
    }

    #[test]
    fn query_matches_recent_summary_and_file_path() {
        let storage = storage(
            vec![recent("/logs/plain.log", ParserType::Text(()))],
            vec![folder(
                "/fav",
                vec![file("/fav/errors/trace.bin", "trace.bin")],
            )],
        );

        let mut matcher = build_matcher("plain");
        let results = recompute_results(&storage, &mut matcher);
        assert_eq!(result_names(&results), vec!["plain.log"]);

        let mut matcher = build_matcher("errors");
        let results = recompute_results(&storage, &mut matcher);
        assert_eq!(result_names(&results), vec!["trace.bin"]);
    }

    #[test]
    fn recent_title_match_is_highlighted() {
        let storage = storage(
            vec![recent("/logs/errors.log", ParserType::Text(()))],
            Vec::new(),
        );
        let mut matcher = build_matcher("err");

        let results = recompute_results(&storage, &mut matcher);

        let QuickOpenItem::RecentSession { title, summary, .. } = &results[0] else {
            panic!("expected recent-session result");
        };
        assert_eq!(title.highlights, vec![0..3]);
        assert!(summary.highlights.is_empty());
    }

    #[test]
    fn recent_summary_match_is_highlighted() {
        let storage = storage(
            vec![recent("/logs/errors.log", ParserType::Text(()))],
            Vec::new(),
        );
        let mut matcher = build_matcher("plain");

        let results = recompute_results(&storage, &mut matcher);

        let QuickOpenItem::RecentSession { title, summary, .. } = &results[0] else {
            panic!("expected recent-session result");
        };
        assert!(title.highlights.is_empty());
        assert_eq!(
            summary.highlights.as_slice(),
            &[substring_range(&summary.text, "Plain")]
        );
    }

    #[test]
    fn favorite_name_and_path_matches_are_highlighted() {
        let storage = storage(
            Vec::new(),
            vec![folder(
                "/fav",
                vec![file("/fav/errors/trace.bin", "trace.bin")],
            )],
        );

        let mut matcher = build_matcher("trace");
        let results = recompute_results(&storage, &mut matcher);
        let QuickOpenItem::FavoriteFile {
            name, path_text, ..
        } = &results[0]
        else {
            panic!("expected favorite-file result");
        };
        assert_eq!(name.highlights, vec![0..5]);
        assert_eq!(
            path_text.highlights.as_slice(),
            &[substring_range(&path_text.text, "trace")]
        );

        let mut matcher = build_matcher("errors");
        let results = recompute_results(&storage, &mut matcher);
        let QuickOpenItem::FavoriteFile {
            name, path_text, ..
        } = &results[0]
        else {
            panic!("expected favorite-file result");
        };
        assert!(name.highlights.is_empty());
        assert_eq!(
            path_text.highlights.as_slice(),
            &[substring_range(&path_text.text, "errors")]
        );
    }

    #[test]
    fn empty_query_results_have_no_highlights() {
        let storage = storage(
            vec![recent("/logs/errors.log", ParserType::Text(()))],
            vec![folder("/fav", vec![file("/fav/trace.bin", "trace.bin")])],
        );
        let mut matcher = build_matcher("");

        let results = recompute_results(&storage, &mut matcher);

        for result in &results {
            match result {
                QuickOpenItem::RecentSession { title, summary, .. } => {
                    assert!(title.highlights.is_empty());
                    assert!(summary.highlights.is_empty());
                }
                QuickOpenItem::FavoriteFile {
                    name, path_text, ..
                } => {
                    assert!(name.highlights.is_empty());
                    assert!(path_text.highlights.is_empty());
                }
            }
        }
    }

    fn substring_range(text: &str, substring: &str) -> Range<usize> {
        let start = text.find(substring).expect("substring should exist");
        start..start + substring.len()
    }

    #[test]
    fn result_cache_is_capped() {
        let files = (0..(RESULT_LIMIT + 5))
            .map(|idx| file(&format!("/fav/{idx}.log"), &format!("{idx}.log")))
            .collect();
        let storage = storage(Vec::new(), vec![folder("/fav", files)]);
        let mut matcher = build_matcher("");

        let results = recompute_results(&storage, &mut matcher);

        assert_eq!(results.len(), RESULT_LIMIT);
    }
}
