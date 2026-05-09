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
        storage::{RecentSessionReopenMode, RecentSessionSnapshot, RecentSessionsStorage},
    },
};

pub fn render_matching_recent_sessions(
    session_setup_id: uuid::Uuid,
    current_stream: StreamNames,
    current_parser: ParserNames,
    recent_sessions: &mut RecentSessionsStorage,
    cmd_tx: &Sender<HostCommand>,
    actions: &mut UiActions,
    ui: &mut Ui,
) {
    let mut has_matches = false;

    let mut remove_session = None;

    for session in &recent_sessions.sessions {
        if session.parser_kind() != current_parser || session.stream_kind() != Some(current_stream)
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
                    open_recent_session(
                        cmd_tx,
                        actions,
                        session.clone(),
                        RecentSessionReopenMode::RestoreSession,
                        Some(session_setup_id),
                    );
                }
                RecentSessionRowAction::RestoreParserConfiguration => {
                    open_recent_session(
                        cmd_tx,
                        actions,
                        session.clone(),
                        RecentSessionReopenMode::RestoreParserConfiguration,
                        Some(session_setup_id),
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
    cmd_tx: &Sender<HostCommand>,
    actions: &mut UiActions,
    snapshot: RecentSessionSnapshot,
    mode: RecentSessionReopenMode,
    session_setup_id: Option<uuid::Uuid>,
) {
    if let Err(message) = snapshot.validate() {
        actions.add_notification(AppNotification::Error(message));
        return;
    }

    let cmd = HostCommand::OpenRecentSession(Box::new(OpenRecentSessionParam {
        snapshot,
        mode,
        session_setup_id,
    }));
    actions.try_send_command(cmd_tx, cmd);
}
