//! Recent-sessions UI for the home screen.
//!
//! This module renders the recent-sessions panel and forwards reopen actions to
//! the host service.

use egui::Ui;
use tokio::sync::mpsc::Sender;

use crate::host::{
    command::{HostCommand, OpenRecentSessionParam},
    common::parsers::ParserNames,
    ui::{
        UiActions,
        storage::{RecentSessionReopenMode, RecentSessionSnapshot, RecentSessionsStorage},
    },
};

#[derive(Debug)]
pub struct RecentSessionsUi {
    cmd_tx: Sender<HostCommand>,
}

impl RecentSessionsUi {
    /// Creates the home-screen recent-sessions UI controller.
    pub fn new(cmd_tx: Sender<HostCommand>) -> Self {
        Self { cmd_tx }
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

        egui::ScrollArea::vertical()
            .id_salt("recent_files_scroll")
            .show(ui, |ui| {
                ui.label("List of recently opened sessions.");
                ui.add_space(5.0);

                let remove_session = {
                    let mut remove_session = None;

                    for session in &recent_sessions.sessions {
                        ui.group(|ui| {
                            ui.horizontal_wrapped(|ui| {
                                ui.strong(session.title());
                                ui.label(format!("({})", ParserNames::from(&session.parser)));
                            });
                            ui.label(session.summary());

                            ui.horizontal(|ui| {
                                if ui.small_button("Restore").clicked() {
                                    self.open_recent_session(
                                        actions,
                                        session,
                                        RecentSessionReopenMode::RestoreSession,
                                    );
                                }

                                if ui.small_button("Parser").clicked() {
                                    self.open_recent_session(
                                        actions,
                                        session,
                                        RecentSessionReopenMode::RestoreParserConfiguration,
                                    );
                                }

                                if session.supports_clean_open()
                                    && ui.small_button("Open").clicked()
                                {
                                    self.open_recent_session(
                                        actions,
                                        session,
                                        RecentSessionReopenMode::OpenClean,
                                    );
                                }

                                if ui.small_button("Remove").clicked() {
                                    remove_session = Some(session.source_key.clone());
                                }
                            });
                        });
                        ui.add_space(4.0);
                    }

                    remove_session
                };

                if let Some(source_key) = remove_session {
                    recent_sessions.remove_session(&source_key);
                }
            });
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
