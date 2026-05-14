//! Recent-sessions UI for the home screen.
//!
//! This module renders the recent-sessions panel and forwards reopen actions to
//! the host service.

use std::sync::Arc;

use egui::{Align, Key, Layout, Modifiers, Response, Ui, Widget, vec2};
use tokio::sync::mpsc::Sender;
use uuid::Uuid;

use crate::{
    common::ui::{
        buttons,
        modal::{ModalSize, show_modal},
        substring_matcher::SubstringMatcher,
        visibility_tracker::VisibilityTracker,
    },
    host::{
        command::{HostCommand, OpenRecentSessionParam},
        common::ui_utls::sized_singleline_text_edit,
        ui::{
            UiActions,
            recent_session::{
                RecentSessionRowAction, RecentSessionRowParams, render_recent_session_row,
            },
            state::plugin::PluginsState,
            storage::recent::{
                session::{RecentSessionReopenMode, RecentSessionSnapshot},
                storage::RecentSessionsStorage,
                validation::validate_reopen_request,
            },
        },
    },
};

#[derive(Debug)]
pub struct RecentSessionsUi {
    query: String,
    matcher: SubstringMatcher,
    cmd_tx: Sender<HostCommand>,
    // Used to focus the recent-sessions filter when the home panel becomes visible again.
    visibility_tracker: VisibilityTracker,
    /// Arbitrary value to avoid persisting scroll state after app restart.
    scroll_salt: Uuid,
    /// Source key of the recent session selected by keyboard navigation.
    selected_source_key: Option<Arc<str>>,
    /// True for one frame after keyboard navigation should reveal the selected row.
    scroll_selected_into_view: bool,
    /// Invalid-session prompt currently awaiting user confirmation.
    pending_invalid_session: Option<InvalidRecentPrompt>,
}

/// Pending validation failure shown before a recent session is removed.
#[derive(Debug)]
struct InvalidRecentPrompt {
    source_key: Arc<str>,
    message: String,
}

#[derive(Debug, Clone, Copy)]
enum SelectionDirection {
    Previous,
    Next,
}

impl RecentSessionsUi {
    /// Creates the home-screen recent-sessions UI controller.
    pub fn new(cmd_tx: Sender<HostCommand>) -> Self {
        Self {
            query: String::new(),
            matcher: SubstringMatcher::default(),
            cmd_tx,
            visibility_tracker: VisibilityTracker::default(),
            scroll_salt: Uuid::new_v4(),
            selected_source_key: None,
            scroll_selected_into_view: false,
            pending_invalid_session: None,
        }
    }

    /// Renders the recent-sessions panel and applies list actions to the
    /// recent-sessions storage domain.
    pub fn render_content(
        &mut self,
        actions: &mut UiActions,
        recent_sessions: &mut RecentSessionsStorage,
        plugins: &PluginsState,
        ui: &mut Ui,
    ) {
        ui.heading("Recently opened");
        ui.add_space(4.0);

        let focus_filter = self.visibility_tracker.is_newly_visible(ui);
        let query_response =
            sized_singleline_text_edit(ui, &mut self.query, vec2(ui.available_width(), 27.0), 7)
                .hint_text("Filter recent sessions")
                .ui(ui);
        if focus_filter {
            query_response.request_focus();
        }
        let query_changed = query_response.changed();
        if query_changed {
            self.matcher.build_query(self.query.trim());
        }

        if query_changed {
            self.refresh_selection(recent_sessions, true);
            self.scroll_selected_into_view = self.selected_source_key.is_some();
        } else if focus_filter && self.selected_source_key.is_none() {
            // Seed selection on first focus so Enter opens the top recent session immediately.
            self.refresh_selection(recent_sessions, false);
        }

        let filter_has_focus = query_response.has_focus();
        self.handle_filter_keys(
            actions,
            recent_sessions,
            plugins,
            ui,
            &query_response,
            filter_has_focus,
        );

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

                        let selected = self.session_is_selected(session);
                        let params = RecentSessionRowParams {
                            show_clean_open: true,
                            selected,
                            selection_active: filter_has_focus,
                            scroll_to_row: selected && self.scroll_selected_into_view,
                        };

                        if let Some(action) = render_recent_session_row(ui, session, &params) {
                            self.apply_row_action(
                                actions,
                                session,
                                action,
                                plugins,
                                &mut remove_session,
                            );
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
                    self.refresh_selection(recent_sessions, false);
                }
            });
        self.scroll_selected_into_view = false;

        self.render_invalid_session_modal(recent_sessions, ui);
    }

    fn refresh_selection(
        &mut self,
        recent_sessions: &RecentSessionsStorage,
        force_first_match: bool,
    ) {
        let mut first_visible = None;

        for session in &recent_sessions.sessions {
            if !matches_recent_session_query(&mut self.matcher, session) {
                continue;
            }

            if force_first_match {
                self.selected_source_key = Some(session.source_key.clone());
                return;
            }

            if self.session_is_selected(session) {
                return;
            }
            first_visible.get_or_insert_with(|| session.source_key.clone());
        }

        self.selected_source_key = first_visible;
    }

    fn handle_filter_keys(
        &mut self,
        actions: &mut UiActions,
        recent_sessions: &RecentSessionsStorage,
        plugins: &PluginsState,
        ui: &mut Ui,
        query_response: &Response,
        filter_has_focus: bool,
    ) {
        if filter_has_focus {
            let select_direction = ui.input_mut(|input| {
                if input.consume_key(Modifiers::NONE, Key::ArrowDown)
                    || input.consume_key(Modifiers::CTRL, Key::N)
                {
                    return Some(SelectionDirection::Next);
                }

                if input.consume_key(Modifiers::NONE, Key::ArrowUp)
                    || input.consume_key(Modifiers::CTRL, Key::P)
                {
                    return Some(SelectionDirection::Previous);
                }

                None
            });

            if let Some(direction) = select_direction {
                self.move_selection(recent_sessions, direction);
            }
        }

        let filter_submitted =
            query_response.lost_focus() && ui.input(|input| input.key_pressed(Key::Enter));
        let should_restore = filter_submitted
            || (filter_has_focus
                && ui.input_mut(|input| input.consume_key(Modifiers::NONE, Key::Enter)));
        if should_restore {
            self.open_selected_session(actions, recent_sessions, plugins);
        }
    }

    fn move_selection(
        &mut self,
        recent_sessions: &RecentSessionsStorage,
        direction: SelectionDirection,
    ) {
        let source_keys: Vec<_> = recent_sessions
            .sessions
            .iter()
            .filter(|session| matches_recent_session_query(&mut self.matcher, session))
            .map(|session| &session.source_key)
            .collect();
        if source_keys.is_empty() {
            self.selected_source_key = None;
            return;
        }

        let current_index = self.selected_source_key.as_ref().and_then(|selected| {
            source_keys
                .iter()
                .position(|&source_key| source_key.as_ref() == selected.as_ref())
        });

        let next_index = match direction {
            SelectionDirection::Previous => current_index
                .map(|index| index.checked_sub(1).unwrap_or(source_keys.len() - 1))
                .unwrap_or(source_keys.len() - 1),
            SelectionDirection::Next => current_index
                .map(|index| (index + 1) % source_keys.len())
                .unwrap_or(0),
        };

        self.selected_source_key = Some(Arc::clone(source_keys[next_index]));
        self.scroll_selected_into_view = true;
    }

    fn open_selected_session(
        &mut self,
        actions: &mut UiActions,
        recent_sessions: &RecentSessionsStorage,
        plugins: &PluginsState,
    ) {
        let Some(selected_source_key) = self.selected_source_key.clone() else {
            return;
        };
        let Some(session) = recent_sessions
            .sessions
            .iter()
            .find(|session| session.source_key.as_ref() == selected_source_key.as_ref())
        else {
            return;
        };

        self.open_recent_session(
            actions,
            session,
            RecentSessionReopenMode::RestoreSession,
            plugins,
        );
    }

    fn session_is_selected(&self, session: &RecentSessionSnapshot) -> bool {
        self.selected_source_key
            .as_ref()
            .is_some_and(|source_key| source_key.as_ref() == session.source_key.as_ref())
    }

    fn apply_row_action(
        &mut self,
        actions: &mut UiActions,
        session: &RecentSessionSnapshot,
        action: RecentSessionRowAction,
        plugins: &PluginsState,
        remove_session: &mut Option<Arc<str>>,
    ) {
        match action {
            RecentSessionRowAction::RestoreSession => {
                self.open_recent_session(
                    actions,
                    session,
                    RecentSessionReopenMode::RestoreSession,
                    plugins,
                );
            }
            RecentSessionRowAction::RestoreParserConfiguration => {
                self.open_recent_session(
                    actions,
                    session,
                    RecentSessionReopenMode::RestoreParserConfiguration,
                    plugins,
                );
            }
            RecentSessionRowAction::OpenClean => {
                self.open_recent_session(
                    actions,
                    session,
                    RecentSessionReopenMode::OpenClean,
                    plugins,
                );
            }
            RecentSessionRowAction::Remove => {
                *remove_session = Some(session.source_key.clone());
            }
        }
    }

    fn open_recent_session(
        &mut self,
        actions: &mut UiActions,
        snapshot: &RecentSessionSnapshot,
        mode: RecentSessionReopenMode,
        plugins: &PluginsState,
    ) {
        if let Err(message) = validate_reopen_request(snapshot, mode, plugins) {
            self.pending_invalid_session = Some(InvalidRecentPrompt {
                source_key: snapshot.source_key.clone(),
                message: message.to_string(),
            });
            return;
        }

        let cmd = HostCommand::OpenRecentSession(Box::new(OpenRecentSessionParam {
            snapshot: snapshot.clone(),
            mode,
            session_setup_id: None,
        }));
        actions.try_send_command(&self.cmd_tx, cmd);
    }

    fn render_invalid_session_modal(
        &mut self,
        recent_sessions: &mut RecentSessionsStorage,
        ui: &mut Ui,
    ) {
        let Some(prompt) = &self.pending_invalid_session else {
            return;
        };

        let source_key = prompt.source_key.clone();
        let message = prompt.message.clone();
        let mut remove_session = false;

        let modal = show_modal(
            ui,
            "invalid_recent_session",
            ModalSize::MaxWidth(530.0),
            |ui, _size| {
                ui.vertical_centered(|ui| {
                    ui.heading("Unable to open recent session");
                });

                ui.add_space(8.0);
                ui.label(message.as_str());
                ui.add_space(12.0);

                ui.with_layout(Layout::right_to_left(Align::Center), |ui| {
                    if ui.add(buttons::command("Cancel", None)).clicked() {
                        ui.close();
                    }

                    if ui
                        .add(buttons::command("Remove recent session", Some(150.0)))
                        .clicked()
                    {
                        remove_session = true;
                        ui.close();
                    }
                });
            },
        );

        if remove_session {
            recent_sessions.remove_session(&source_key);
            self.refresh_selection(recent_sessions, false);
        }

        if remove_session || modal.should_close() {
            self.pending_invalid_session = None;
        }
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

    use super::{RecentSessionsUi, SelectionDirection, matches_recent_session_query};
    use crate::{
        common::ui::substring_matcher::SubstringMatcher,
        host::ui::storage::recent::{
            session::{RecentSessionSnapshot, RecentSessionSource},
            storage::RecentSessionsStorage,
        },
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

    fn recent_ui() -> RecentSessionsUi {
        let (cmd_tx, _cmd_rx) = tokio::sync::mpsc::channel(1);
        RecentSessionsUi::new(cmd_tx)
    }

    fn storage_with(sessions: Vec<RecentSessionSnapshot>) -> RecentSessionsStorage {
        let mut storage = RecentSessionsStorage::default();
        storage.sessions = sessions;
        storage
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

    #[test]
    fn query_change_selects_first_visible_session() {
        let alpha = file_session("alpha.log", ParserType::Text(()));
        let beta = file_session("beta.log", ParserType::Text(()));
        let storage = storage_with(vec![beta.clone(), alpha.clone()]);
        let mut recent_ui = recent_ui();
        recent_ui.selected_source_key = Some(alpha.source_key.clone());
        recent_ui.matcher.build_query("log");

        recent_ui.refresh_selection(&storage, true);

        assert_eq!(
            recent_ui.selected_source_key.as_deref(),
            Some(beta.source_key.as_ref())
        );
    }

    #[test]
    fn keyboard_selection_wraps_through_visible_sessions() {
        let alpha = file_session("visible-alpha.log", ParserType::Text(()));
        let hidden = file_session("hidden.log", ParserType::Text(()));
        let beta = file_session("visible-beta.log", ParserType::Text(()));
        let storage = storage_with(vec![alpha.clone(), hidden, beta.clone()]);
        let mut recent_ui = recent_ui();
        recent_ui.matcher.build_query("visible");
        recent_ui.refresh_selection(&storage, true);

        recent_ui.move_selection(&storage, SelectionDirection::Previous);
        assert_eq!(
            recent_ui.selected_source_key.as_deref(),
            Some(beta.source_key.as_ref())
        );

        recent_ui.move_selection(&storage, SelectionDirection::Next);
        assert_eq!(
            recent_ui.selected_source_key.as_deref(),
            Some(alpha.source_key.as_ref())
        );
    }
}
