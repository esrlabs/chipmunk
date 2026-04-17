use egui::{Align, Id, Layout, RichText, Ui, Widget, vec2};
use stypes::Transport;
use tokio::sync::mpsc;
use uuid::Uuid;

use crate::{
    common::{phosphor::icons, ui::buttons},
    host::ui::{
        UiActions,
        session_setup::{
            RenderOutcome, main_config,
            state::sources::{MulticastItem, StreamConfig, UdpConfig},
        },
    },
    session::{
        command::{AttachSource, SessionCommand},
        types::ObserveOperation,
        ui::shared::SessionShared,
    },
};

#[derive(Debug)]
pub struct UdpObserveUi {
    id: Id,
    cmd_tx: mpsc::Sender<SessionCommand>,
    config: UdpConfig,
}

impl UdpObserveUi {
    pub fn new(id_salt: Uuid, cmd_tx: mpsc::Sender<SessionCommand>) -> Self {
        let id = Id::new(format!("side_udp_{id_salt}"));

        Self {
            id,
            cmd_tx,
            config: UdpConfig::new(),
        }
    }

    pub fn render_content(
        &mut self,
        ui: &mut Ui,
        shared: &mut SessionShared,
        actions: &mut UiActions,
    ) {
        super::render_group_title(ui, "UDP Connections");

        ui.add_space(super::SPACE_BETWEEN_GROUPS);

        self.attach_udp(ui, actions);

        ui.add_space(super::SPACE_BETWEEN_GROUPS);

        super::render_stream_ops(
            ui,
            shared.observe.operations(),
            "Connected",
            "Disconnected",
            |ui, op, idx| {
                self.render_udp_item(ui, op, idx, actions);
            },
        );
    }

    fn attach_udp(&mut self, ui: &mut Ui, actions: &mut UiActions) {
        super::render_attach_source(ui, self.id, "New Connection", |ui| {
            let mut outcome = main_config::render_socket_address(&mut self.config, ui);
            if !self.config.multicasts.is_empty() {
                main_config::udp::render_multicasts(&mut self.config, ui);
            }

            ui.allocate_ui_with_layout(
                vec2(ui.available_width(), 30.),
                Layout::right_to_left(Align::Center),
                |ui| {
                    let connect_btn = ui.add_enabled(
                        self.config.is_valid(),
                        buttons::side_panel_primary("Connect"),
                    );
                    if connect_btn.clicked() {
                        outcome = RenderOutcome::StartSession;
                    }

                    if ui
                        .add(buttons::side_panel_primary("Add Multicast"))
                        .clicked()
                    {
                        self.config.multicasts.push(MulticastItem::new());
                    }
                },
            );

            if outcome == RenderOutcome::StartSession {
                let cmd = SessionCommand::AttachSource {
                    source: AttachSource::Stream(Box::new(StreamConfig::Udp(
                        self.config.to_owned(),
                    ))),
                };
                self.config.bind_addr.clear();
                self.config.validate();

                actions.try_send_command(&self.cmd_tx, cmd);
            }
        });
    }

    fn render_udp_item(
        &self,
        ui: &mut Ui,
        operation: &ObserveOperation,
        idx: usize,
        actions: &mut UiActions,
    ) {
        let (source_uuid, config) = match &operation.origin {
            stypes::ObserveOrigin::Stream(uuid, Transport::UDP(config)) => (uuid, config),
            _ => return,
        };

        super::render_observe_item(
            ui,
            actions,
            idx,
            icons::regular::BROADCAST,
            |ui| {
                ui.label(RichText::new(&config.bind_addr).strong());
            },
            |ui, actions| {
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
                        let to_send = UdpConfig::from(config);
                        let cmd = SessionCommand::AttachSource {
                            source: AttachSource::Stream(Box::new(StreamConfig::Udp(to_send))),
                        };

                        actions.try_send_command(&self.cmd_tx, cmd);
                    }
                }
            },
            |ui, actions| {
                let is_running = operation.phase().is_running();
                let label = if is_running { "Disconnect" } else { "Connect" };

                if ui.button(label).clicked() {
                    let cmd = if is_running {
                        SessionCommand::CancelOperation { id: operation.id }
                    } else {
                        let stream_cfg = StreamConfig::Udp(UdpConfig::from(config));
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
