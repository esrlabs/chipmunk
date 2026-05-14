//! Matching recent-session list for the stream session-setup surface.

use egui::Ui;
use tokio::sync::mpsc::Sender;

use crate::host::{
    command::{HostCommand, OpenRecentSessionParam},
    common::{parsers::ParserNames, sources::StreamNames},
    notification::AppNotification,
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
};

pub(super) struct MatchingRecentSessions<'a> {
    session_setup_id: uuid::Uuid,
    cmd_tx: &'a Sender<HostCommand>,
    actions: &'a mut UiActions,
    plugins: &'a PluginsState,
}

impl<'a> MatchingRecentSessions<'a> {
    pub fn new(
        session_setup_id: uuid::Uuid,
        cmd_tx: &'a Sender<HostCommand>,
        actions: &'a mut UiActions,
        plugins: &'a PluginsState,
    ) -> Self {
        Self {
            session_setup_id,
            cmd_tx,
            actions,
            plugins,
        }
    }

    pub fn render(
        &mut self,
        current_stream: StreamNames,
        current_parser: ParserNames,
        recent_sessions: &mut RecentSessionsStorage,
        ui: &mut Ui,
    ) {
        let mut has_matches = false;

        let mut remove_session = None;

        for session in &recent_sessions.sessions {
            if session.parser_kind() != current_parser
                || session.stream_kind() != Some(current_stream)
            {
                continue;
            }

            has_matches = true;

            const PARAMS: RecentSessionRowParams = RecentSessionRowParams {
                show_clean_open: false,
                selected: false,
                selection_active: false,
                scroll_to_row: false,
            };

            let render_action = render_recent_session_row(ui, session, &PARAMS);
            if let Some(action) = render_action {
                match action {
                    RecentSessionRowAction::RestoreSession => {
                        self.open_recent_session(
                            session.clone(),
                            RecentSessionReopenMode::RestoreSession,
                        );
                    }
                    RecentSessionRowAction::RestoreParserConfiguration => {
                        self.open_recent_session(
                            session.clone(),
                            RecentSessionReopenMode::RestoreParserConfiguration,
                        );
                    }
                    RecentSessionRowAction::OpenClean => {
                        debug_assert!(
                            false,
                            "Clean open is disabled in session setup recent sessions"
                        );
                    }
                    RecentSessionRowAction::Remove => {
                        remove_session = Some(session.source_key.clone());
                    }
                }
            }
            ui.add_space(4.0);
        }

        if !has_matches {
            ui.label("No matching recent sessions yet.");
        }

        if let Some(source_key) = remove_session {
            recent_sessions.remove_session(&source_key);
        }
    }

    fn open_recent_session(
        &mut self,
        snapshot: RecentSessionSnapshot,
        mode: RecentSessionReopenMode,
    ) {
        if let Err(message) = validate_reopen_request(&snapshot, mode, self.plugins) {
            self.actions
                .add_notification(AppNotification::Error(message.to_string()));
            return;
        }

        let cmd = HostCommand::OpenRecentSession(Box::new(OpenRecentSessionParam {
            snapshot,
            mode,
            session_setup_id: Some(self.session_setup_id),
        }));
        self.actions.try_send_command(self.cmd_tx, cmd);
    }
}
