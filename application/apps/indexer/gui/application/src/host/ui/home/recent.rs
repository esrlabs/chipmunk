//! Recent-sessions UI for the home screen.
//!
//! This module renders the recent-sessions panel and forwards reopen actions to
//! the host service.

use egui::{Button, RichText, Ui};
use tokio::sync::mpsc::Sender;

use crate::common::phosphor::icons;
use crate::host::{
    command::HostCommand,
    ui::{
        UiActions,
        storage::{LoadState, RecentSessionsStorage, SessionConfig},
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

                let (remove_session, remove_cfg) = {
                    let LoadState::Ready(data) = &recent_sessions.state else {
                        ui.label("Loading recent sessions...");
                        return;
                    };

                    let mut remove_session = None;
                    let mut remove_cfg = None;

                    for session in &data.sessions {
                        ui.collapsing(session.title.as_str(), |ui| {
                            let cfg_len = session.configurations.len();
                            let cfg_tpl = session.new_configuration();

                            if cfg_len > 1 || cfg_tpl.is_some() {
                                ui.horizontal(|ui| {
                                    if cfg_len > 1
                                        && ui
                                            .add(
                                                Button::new(
                                                    RichText::new(icons::regular::TRASH).size(12.0),
                                                )
                                                .small(),
                                            )
                                            .on_hover_text("Remove all configurations")
                                            .clicked()
                                    {
                                        remove_session = Some(session.title.clone());
                                    }

                                    if let Some(cfg) = cfg_tpl
                                        && ui
                                            .add(
                                                Button::new(
                                                    RichText::new(icons::regular::PLUS).size(12.0),
                                                )
                                                .small(),
                                            )
                                            .on_hover_text("New configuration")
                                            .clicked()
                                    {
                                        self.open_new_configuration(actions, cfg);
                                    }
                                });
                            }

                            for cfg in &session.configurations {
                                ui.horizontal(|ui| {
                                    if ui
                                        .add(
                                            Button::new(
                                                RichText::new(icons::regular::ARROW_SQUARE_OUT)
                                                    .size(12.0),
                                            )
                                            .small(),
                                        )
                                        .on_hover_text("Open configuration")
                                        .clicked()
                                    {
                                        self.open_previous_configuration(actions, cfg);
                                    }

                                    if ui
                                        .add(
                                            Button::new(
                                                RichText::new(icons::regular::X).size(12.0),
                                            )
                                            .small(),
                                        )
                                        .on_hover_text("Remove configuration")
                                        .clicked()
                                    {
                                        remove_cfg = Some((session.title.clone(), cfg.id.clone()));
                                    }

                                    ui.label(format!("{cfg}"));
                                });
                            }
                        });
                    }

                    (remove_session, remove_cfg)
                };

                if let Some((title, id)) = remove_cfg {
                    recent_sessions.remove_configuration(&title, &id);
                }

                if let Some(title) = remove_session {
                    recent_sessions.remove_session(&title);
                }
            });
    }

    fn open_new_configuration(&self, actions: &mut UiActions, cfg: &SessionConfig) {
        let cmd = HostCommand::OpenNewConfiguration(Box::new(cfg.options.clone()));
        actions.try_send_command(&self.cmd_tx, cmd);
    }

    fn open_previous_configuration(&self, actions: &mut UiActions, cfg: &SessionConfig) {
        let cmd = HostCommand::OpenPreviousConfiguration(Box::new(cfg.options.clone()));
        actions.try_send_command(&self.cmd_tx, cmd);
    }
}
