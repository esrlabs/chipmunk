//! Recent-sessions UI for the home screen.
//!
//! This module renders the recent-sessions panel and forwards reopen actions to
//! the host service.

use egui::{Ui, Widget, vec2};
use tokio::sync::mpsc::Sender;
use uuid::Uuid;

use crate::{
    common::ui::substring_matcher::SubstringMatcher,
    host::{
        command::{HostCommand, OpenRecentSessionParam},
        common::ui_utls::sized_singleline_text_edit,
        ui::{
            UiActions,
            recent_session::{
                RecentSessionRowAction, RecentSessionRowOptions, render_recent_session_row,
            },
            storage::{RecentSessionReopenMode, RecentSessionSnapshot, RecentSessionsStorage},
        },
    },
};

#[derive(Debug)]
pub struct RecentSessionsUi {
    query: String,
    matcher: SubstringMatcher,
    cmd_tx: Sender<HostCommand>,
    /// Arbitrary value to avoid persisting scroll state after app restart.
    scroll_salt: Uuid,
}

impl RecentSessionsUi {
    /// Creates the home-screen recent-sessions UI controller.
    pub fn new(cmd_tx: Sender<HostCommand>) -> Self {
        Self {
            query: String::new(),
            matcher: SubstringMatcher::default(),
            cmd_tx,
            scroll_salt: Uuid::new_v4(),
        }
    }

    /// Renders the recent-sessions panel and applies list actions to the
    /// recent-sessions storage domain.
    pub fn render_content(
        &mut self,
        actions: &mut UiActions,
        recent_sessions: &mut RecentSessionsStorage,
        ui: &mut Ui,
    ) {
        ui.heading("Recently opened");
        ui.add_space(4.0);

        let query_changed =
            sized_singleline_text_edit(ui, &mut self.query, vec2(ui.available_width(), 27.0), 7)
                .hint_text("Filter recent sessions")
                .ui(ui)
                .changed();
        if query_changed {
            self.matcher.build_query(self.query.trim());
        }

        ui.add_space(4.0);

        egui::ScrollArea::vertical()
            .id_salt(("recent_files_scroll", self.scroll_salt))
            .show(ui, |ui| {
                if recent_sessions.sessions.is_empty() {
                    ui.weak("No recent sessions yet.");
                    return;
                }

                let has_query = self.matcher.has_query();
                let mut any_visible = false;
                let remove_session = {
                    let mut remove_session = None;

                    for session in &recent_sessions.sessions {
                        if !matches_recent_session_query(&mut self.matcher, session) {
                            continue;
                        }

                        any_visible = true;

                        const OPTIONS: RecentSessionRowOptions = RecentSessionRowOptions {
                            show_clean_open: true,
                        };

                        if let Some(action) = render_recent_session_row(ui, session, &OPTIONS) {
                            self.apply_row_action(actions, session, action, &mut remove_session);
                        }
                        ui.add_space(4.0);
                    }

                    remove_session
                };

                if !any_visible && has_query {
                    ui.label("No recent sessions match the current filter.");
                }

                if let Some(source_key) = remove_session {
                    recent_sessions.remove_session(&source_key);
                }
            });
    }

    fn apply_row_action(
        &self,
        actions: &mut UiActions,
        session: &RecentSessionSnapshot,
        action: RecentSessionRowAction,
        remove_session: &mut Option<std::sync::Arc<str>>,
    ) {
        match action {
            RecentSessionRowAction::RestoreSession => {
                self.open_recent_session(actions, session, RecentSessionReopenMode::RestoreSession);
            }
            RecentSessionRowAction::RestoreParserConfiguration => {
                self.open_recent_session(
                    actions,
                    session,
                    RecentSessionReopenMode::RestoreParserConfiguration,
                );
            }
            RecentSessionRowAction::OpenClean => {
                self.open_recent_session(actions, session, RecentSessionReopenMode::OpenClean);
            }
            RecentSessionRowAction::Remove => {
                *remove_session = Some(session.source_key.clone());
            }
        }
    }

    fn open_recent_session(
        &self,
        actions: &mut UiActions,
        snapshot: &RecentSessionSnapshot,
        mode: RecentSessionReopenMode,
    ) {
        let cmd = HostCommand::OpenRecentSession(Box::new(OpenRecentSessionParam {
            snapshot: snapshot.clone(),
            mode,
        }));
        actions.try_send_command(&self.cmd_tx, cmd);
    }
}

fn matches_recent_session_query(
    matcher: &mut SubstringMatcher,
    session: &RecentSessionSnapshot,
) -> bool {
    matcher.matches(session.title()) || matcher.matches(session.summary())
}

#[cfg(test)]
mod tests {
    use std::path::PathBuf;

    use stypes::{FileFormat, ParserType, TCPTransportConfig, Transport};

    use super::matches_recent_session_query;
    use crate::{
        common::ui::substring_matcher::SubstringMatcher,
        host::ui::storage::{RecentSessionSnapshot, RecentSessionSource},
    };

    fn file_session(path: &str, parser: ParserType) -> RecentSessionSnapshot {
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

    fn stream_session(bind_addr: &str) -> RecentSessionSnapshot {
        RecentSessionSnapshot::new(
            1,
            vec![RecentSessionSource::Stream {
                transport: Transport::TCP(TCPTransportConfig {
                    bind_addr: bind_addr.to_owned(),
                }),
            }],
            ParserType::Text(()),
            Default::default(),
        )
    }

    fn build_matcher(query: &str) -> SubstringMatcher {
        let mut matcher = SubstringMatcher::default();
        matcher.build_query(query.trim());
        matcher
    }

    #[test]
    fn empty_query_matches_all_sessions() {
        let session = file_session("alpha.log", ParserType::Text(()));

        assert!(matches_recent_session_query(
            &mut build_matcher(""),
            &session
        ));
        assert!(matches_recent_session_query(
            &mut build_matcher("   "),
            &session
        ));
    }

    #[test]
    fn query_matches_title_ignoring_case() {
        let session = file_session("ErrorTrace.log", ParserType::Text(()));

        assert!(matches_recent_session_query(
            &mut build_matcher("error"),
            &session
        ));
    }

    #[test]
    fn query_matches_summary_ignoring_case() {
        let session = file_session("trace.log", ParserType::Text(()));

        assert!(matches_recent_session_query(
            &mut build_matcher("plain"),
            &session
        ));
    }

    #[test]
    fn query_matches_stream_summary() {
        let session = stream_session("127.0.0.1:5555");

        assert!(matches_recent_session_query(
            &mut build_matcher("tcp"),
            &session
        ));
    }

    #[test]
    fn query_does_not_match_tooltip_only_text() {
        let session = file_session("/logs/alpha.log", ParserType::Text(()));

        assert!(!matches_recent_session_query(
            &mut build_matcher("/logs"),
            &session
        ));
    }
}
