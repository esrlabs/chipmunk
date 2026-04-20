//! Matching recent-session list for the stream session-setup surface.

use egui::Ui;
use tokio::sync::mpsc::Sender;

use crate::host::{
    command::{HostCommand, OpenRecentSessionParam},
    common::{parsers::ParserNames, sources::StreamNames},
    ui::{
        UiActions,
        recent_session::{
            RecentSessionRowAction, RecentSessionRowOptions, render_recent_session_row,
        },
        storage::{RecentSessionReopenMode, RecentSessionSnapshot, RecentSessionsStorage},
    },
};

pub fn render_matching_recent_sessions(
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

        const OPTIONS: RecentSessionRowOptions = RecentSessionRowOptions {
            show_clean_open: false,
        };

        let render_action = render_recent_session_row(ui, session, &OPTIONS);
        if let Some(action) = render_action {
            match action {
                RecentSessionRowAction::RestoreSession => {
                    open_recent_session(
                        cmd_tx,
                        actions,
                        session.clone(),
                        RecentSessionReopenMode::RestoreSession,
                    );
                }
                RecentSessionRowAction::RestoreParserConfiguration => {
                    open_recent_session(
                        cmd_tx,
                        actions,
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
    cmd_tx: &Sender<HostCommand>,
    actions: &mut UiActions,
    snapshot: RecentSessionSnapshot,
    mode: RecentSessionReopenMode,
) {
    let cmd = HostCommand::OpenRecentSession(Box::new(OpenRecentSessionParam { snapshot, mode }));
    actions.try_send_command(cmd_tx, cmd);
}
