use egui::{Align, Button, Id, Layout, RichText, Ui, Widget};
use stypes::Transport;
use tokio::sync::mpsc;
use uuid::Uuid;

use crate::{
    common::phosphor::icons,
    host::ui::{
        UiActions,
        session_setup::{
            RenderOutcome, main_config,
            state::sources::{StreamConfig, TcpConfig},
        },
    },
    session::{
        command::{AttachSource, SessionCommand},
        types::ObserveOperation,
        ui::shared::SessionShared,
    },
};

#[derive(Debug)]
pub struct TcpObserveUi {
    id: Id,
    cmd_tx: mpsc::Sender<SessionCommand>,
    config: TcpConfig,
}

impl TcpObserveUi {
    pub fn new(id_salt: Uuid, cmd_tx: mpsc::Sender<SessionCommand>) -> Self {
        let id = Id::new(format!("side_tcp_{id_salt}"));
        Self {
            id,
            cmd_tx,
            config: TcpConfig::new(),
        }
    }

    pub fn render_content(
        &mut self,
        ui: &mut Ui,
        shared: &mut SessionShared,
        actions: &mut UiActions,
    ) {
        super::render_group_title(ui, "TCP Connections");

        ui.add_space(super::SPACE_BETWEEN_GROUPS);

        self.attach_tcp(ui, actions);

        ui.add_space(super::SPACE_BETWEEN_GROUPS);

        super::render_stream_ops(
            ui,
            shared.observe.operations(),
            "Connected",
            "Disconnected",
            |ui, op, idx| {
                self.render_tcp_item(ui, op, idx, actions);
            },
        );
    }

    fn attach_tcp(&mut self, ui: &mut Ui, actions: &mut UiActions) {
        super::render_attach_source(ui, self.id, "New Connection", |ui| {
            let mut outcome = main_config::render_socket_address(&mut self.config, ui);
            ui.with_layout(Layout::right_to_left(Align::TOP), |ui| {
                if ui
                    .add_enabled(self.config.is_valid(), Button::new("Connect"))
                    .clicked()
                {
                    outcome = RenderOutcome::StartSession;
                }
            });

            if outcome == RenderOutcome::StartSession {
                let cmd = SessionCommand::AttachSource {
                    source: AttachSource::Stream(Box::new(StreamConfig::Tcp(
                        self.config.to_owned(),
                    ))),
                };
                self.config.bind_addr.clear();
                self.config.validate();

                actions.try_send_command(&self.cmd_tx, cmd);
            }
        });
    }

    fn render_tcp_item(
        &self,
        ui: &mut Ui,
        operation: &ObserveOperation,
        idx: usize,
        actions: &mut UiActions,
    ) {
        let config = match &operation.origin {
            stypes::ObserveOrigin::Stream(_, Transport::TCP(config)) => config,
            _ => return,
        };

        super::render_observe_item(
            ui,
            idx,
            "TCP",
            |ui| {
                ui.label(RichText::new(&config.bind_addr).strong());
            },
            |ui| {
                if operation.phase().is_running() {
                    let stop_res = super::get_item_button(icons::regular::STOP_CIRCLE)
                        .ui(ui)
                        .on_hover_text("Disconnect");
                    if stop_res.clicked() {
                        let cmd = SessionCommand::CancelOperation { id: operation.id };
                        actions.try_send_command(&self.cmd_tx, cmd);
                    }
                } else {
                    let run_res = super::get_item_button(icons::regular::PLAY_CIRCLE)
                        .ui(ui)
                        .on_hover_text("Reconnect");
                    if run_res.clicked() {
                        let to_send = TcpConfig::from(config);
                        let cmd = SessionCommand::AttachSource {
                            source: AttachSource::Stream(Box::new(StreamConfig::Tcp(to_send))),
                        };

                        actions.try_send_command(&self.cmd_tx, cmd);
                    }
                }
            },
        );
    }
}
