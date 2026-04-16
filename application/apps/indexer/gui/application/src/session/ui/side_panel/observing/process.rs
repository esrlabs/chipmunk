use egui::{Align, Id, Label, Layout, RichText, TextStyle, Ui, Widget, vec2};
use stypes::Transport;
use tokio::sync::mpsc;
use uuid::Uuid;

use crate::{
    common::phosphor::icons,
    host::{
        common::ui_utls::truncate_path_to_width,
        ui::{
            UiActions,
            session_setup::{
                self,
                state::sources::{ProcessConfig, StreamConfig},
            },
        },
    },
    session::{
        command::{AttachSource, SessionCommand},
        types::ObserveOperation,
        ui::shared::SessionShared,
    },
};

#[derive(Debug)]
pub struct ProcessObserveUi {
    id: Id,
    cmd_tx: mpsc::Sender<SessionCommand>,
    /// Process config is being lazy loaded since it has initialization process.
    config: Option<Box<ProcessConfig>>,
}

impl ProcessObserveUi {
    pub fn new(id_salt: Uuid, cmd_tx: mpsc::Sender<SessionCommand>) -> Self {
        let id = Id::new(format!("side_process_{id_salt}"));
        Self {
            id,
            cmd_tx,
            config: None,
        }
    }

    pub fn render_content(
        &mut self,
        ui: &mut Ui,
        shared: &mut SessionShared,
        actions: &mut UiActions,
    ) {
        super::render_group_title(ui, "Commands");

        ui.add_space(super::SPACE_BETWEEN_GROUPS);

        self.attach_commands(ui, actions);

        ui.add_space(super::SPACE_BETWEEN_GROUPS);

        super::render_stream_ops(
            ui,
            shared.observe.operations(),
            "Running",
            "Finished",
            |ui, op, idx| {
                self.render_command(ui, op, idx, actions);
            },
        );
    }

    fn attach_commands(&mut self, ui: &mut Ui, actions: &mut UiActions) {
        let config = self
            .config
            .get_or_insert_with(|| Box::new(ProcessConfig::new()));

        super::render_attach_source(ui, self.id, "New Command", |ui| {
            use session_setup::{RenderOutcome, main_config::process as host_setup};

            let mut outcome = RenderOutcome::None;

            let row_height = 25.0;
            ui.allocate_ui_with_layout(
                vec2(ui.available_width(), row_height),
                Layout::right_to_left(Align::Center),
                |ui| host_setup::command_and_shell(config, &mut outcome, ui),
            );

            ui.add_space(10.);

            ui.allocate_ui_with_layout(
                vec2(ui.available_width(), row_height),
                Layout::left_to_right(Align::Center),
                |ui| host_setup::working_dir(ui, config, actions, false),
            );

            if outcome == RenderOutcome::StartSession {
                let config_to_send = config.clone();
                config.command.clear();
                config.validate();

                let cmd = SessionCommand::AttachSource {
                    source: AttachSource::Stream(Box::new(StreamConfig::Process(*config_to_send))),
                };

                actions.try_send_command(&self.cmd_tx, cmd);
            }
        });
    }

    fn render_command(
        &self,
        ui: &mut Ui,
        operation: &ObserveOperation,
        idx: usize,
        actions: &mut UiActions,
    ) {
        let (source_uuid, config) = match &operation.origin {
            stypes::ObserveOrigin::Stream(uuid, Transport::Process(config)) => (uuid, config),
            _ => return,
        };
        super::render_observe_item(
            ui,
            actions,
            idx,
            icons::regular::TERMINAL_WINDOW,
            |ui| {
                ui.vertical(|ui| {
                    ui.label(RichText::new(&config.command).strong());
                    let cwd_label = truncate_path_to_width(
                        ui,
                        &config.cwd,
                        ui.available_width(),
                        TextStyle::Body,
                    );
                    let response = Label::new(cwd_label.text)
                        .truncate()
                        .show_tooltip_when_elided(false)
                        .ui(ui);
                    if cwd_label.truncated {
                        response.on_hover_ui(|ui| {
                            ui.set_max_width(ui.spacing().tooltip_width);
                            ui.label(config.cwd.to_string_lossy());
                        });
                    }
                });
            },
            |ui, actions| {
                if operation.phase().is_running() {
                    let stop_res = super::get_item_button(icons::regular::STOP_CIRCLE)
                        .ui(ui)
                        .on_hover_text("Stop Command");
                    if stop_res.clicked() {
                        let cmd = SessionCommand::CancelOperation { id: operation.id };
                        actions.try_send_command(&self.cmd_tx, cmd);
                    }
                } else {
                    let run_res = super::get_item_button(icons::regular::PLAY_CIRCLE)
                        .ui(ui)
                        .on_hover_text("Rerun command");
                    if run_res.clicked() {
                        let to_send = ProcessConfig::from(config);
                        let cmd = SessionCommand::AttachSource {
                            source: AttachSource::Stream(Box::new(StreamConfig::Process(to_send))),
                        };

                        actions.try_send_command(&self.cmd_tx, cmd);
                    }
                }
            },
            |ui, actions| {
                let is_running = operation.phase().is_running();
                let label = if is_running {
                    "Stop Command"
                } else {
                    "Rerun Command"
                };

                if ui.button(label).clicked() {
                    let cmd = if is_running {
                        SessionCommand::CancelOperation { id: operation.id }
                    } else {
                        let stream_cfg = StreamConfig::Process(ProcessConfig::from(config));
                        SessionCommand::AttachSource {
                            source: AttachSource::Stream(Box::new(stream_cfg)),
                        }
                    };

                    actions.try_send_command(&self.cmd_tx, cmd);
                }

                ui.separator();
                if ui.button("Reopen in New Tab").clicked() {
                    super::open_in_new_tab(source_uuid, actions, &self.cmd_tx);
                }
            },
        );
    }
}
