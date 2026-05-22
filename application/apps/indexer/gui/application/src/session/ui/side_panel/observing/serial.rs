use egui::{Align, ComboBox, DragValue, Id, Layout, RichText, TextEdit, Ui, Widget, vec2};
use stypes::Transport;
use tokio::sync::mpsc;
use uuid::Uuid;

use crate::{
    common::{phosphor::icons, ui::buttons},
    host::{
        common::ui_utls::show_validation_message,
        ui::{
            UiActions,
            session_setup::state::sources::{BaudRate, NamedValue, SerialConfig, StreamConfig},
        },
    },
    session::{
        command::{AttachSource, SessionCommand},
        types::ObserveOperation,
        ui::shared::SessionShared,
    },
};

#[derive(Debug)]
pub struct SerialObserveUi {
    id: Id,
    cmd_tx: mpsc::Sender<SessionCommand>,
    config: SerialConfig,
}

impl SerialObserveUi {
    pub fn new(id_salt: Uuid, cmd_tx: mpsc::Sender<SessionCommand>) -> Self {
        let id = Id::new(format!("side_serial_{id_salt}"));
        Self {
            id,
            cmd_tx,
            config: SerialConfig::new(),
        }
    }

    pub fn render_content(
        &mut self,
        ui: &mut Ui,
        shared: &mut SessionShared,
        actions: &mut UiActions,
    ) {
        super::render_group_title(ui, "Serial Connections");

        ui.add_space(super::SPACE_BETWEEN_GROUPS);

        self.attach_serial(ui, actions);

        ui.add_space(super::SPACE_BETWEEN_GROUPS);

        super::render_stream_ops(
            ui,
            shared.observe.operations(),
            "Connected",
            "Disconnected",
            |ui, op, idx| {
                self.render_serial_item(ui, op, idx, actions);
            },
        );
    }

    fn attach_serial(&mut self, ui: &mut Ui, actions: &mut UiActions) {
        super::render_attach_source(ui, self.id, "New Connection", |ui| {
            self.render_serial_form(ui);

            ui.add_space(10.0);
            let row_height = 30.0;
            let can_connect = self.config.is_valid();
            let mut reset_to_defaults = false;
            let mut connect = false;

            ui.allocate_ui_with_layout(
                egui::vec2(ui.available_width(), row_height),
                Layout::left_to_right(Align::Center),
                |ui| {
                    egui::Sides::new().shrink_left().truncate().show(
                        ui,
                        |ui| {
                            let width = ui.available_width().min(100.0);
                            reset_to_defaults = ui
                                .add(
                                    buttons::side_panel_primary("Defaut Settings")
                                        .min_size(vec2(width, 24.0)),
                                )
                                .on_hover_text("Drop Settings to Defaults")
                                .clicked();
                        },
                        |ui| {
                            connect = ui
                                .add_enabled(
                                    can_connect,
                                    buttons::side_panel_primary("Connect")
                                        .min_size(vec2(80.0, 24.0)),
                                )
                                .clicked();
                        },
                    );
                },
            );

            if reset_to_defaults {
                self.config.set_default_settings();
            }

            if connect {
                let cmd = SessionCommand::AttachSource {
                    source: AttachSource::Stream(Box::new(StreamConfig::Serial(
                        self.config.clone(),
                    ))),
                };

                actions.try_send_command(&self.cmd_tx, cmd);
                self.config.reset_connection_input();
            }
        });
    }

    fn render_serial_item(
        &self,
        ui: &mut Ui,
        operation: &ObserveOperation,
        idx: usize,
        actions: &mut UiActions,
    ) {
        let (source_uuid, config) = match &operation.origin {
            stypes::ObserveOrigin::Stream(uuid, Transport::Serial(config)) => (uuid, config),
            _ => return,
        };

        super::render_observe_item(
            ui,
            actions,
            idx,
            icons::regular::USB,
            |ui| {
                ui.vertical(|ui| {
                    ui.label(RichText::new(&config.path).strong());
                    ui.label(format!("{} baud", config.baud_rate));
                });
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
                        let cmd = SessionCommand::AttachSource {
                            source: AttachSource::Stream(Box::new(StreamConfig::Serial(
                                SerialConfig::from(config),
                            ))),
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
                        SessionCommand::AttachSource {
                            source: AttachSource::Stream(Box::new(StreamConfig::Serial(
                                SerialConfig::from(config),
                            ))),
                        }
                    };

                    actions.try_send_command(&self.cmd_tx, cmd);
                }

                ui.separator();
                if ui.button("Reopen in New Tab").clicked() {
                    super::open_in_new_tab(source_uuid, actions, &self.cmd_tx);
                }
            },
        )
        .on_hover_ui(|ui| {
            ui.set_max_width(ui.spacing().tooltip_width);
            ui.label(format!(
                "{} data bits | parity {} | stop bits {}",
                config.data_bits, config.parity, config.stop_bits
            ));
        });
    }

    fn render_serial_form(&mut self, ui: &mut Ui) {
        self.config.check_update_ports();

        ui.add_space(4.0);
        ui.label(RichText::new("Type a custom path").small());

        let row_height = 25.0;

        ui.allocate_ui_with_layout(
            vec2(ui.available_width(), row_height),
            Layout::right_to_left(Align::TOP),
            |ui| {
                let response = ui
                    .scope(|ui| {
                        ui.menu_button(icons::regular::DOTS_THREE_VERTICAL, |ui| {
                            for port in &self.config.available_ports {
                                if ui
                                    .selectable_label(self.config.path == *port, port)
                                    .clicked()
                                {
                                    self.config.path = port.clone();
                                    ui.close();
                                }
                            }
                        })
                    })
                    .inner
                    .response;

                response.on_hover_text("Available ports");

                ui.add(TextEdit::singleline(&mut self.config.path));
            },
        );

        // Preserve the space for the validation message so the controls below stay stable.
        show_validation_message(ui, self.config.port_validation_err());

        ui.add_space(8.0);

        ui.label("Baud Rate");
        ComboBox::from_id_salt("serial_baud_select")
            .width(FIELD_WIDTH.min(ui.available_width()))
            .truncate()
            .selected_text(self.config.baud_rate.ui_text())
            .show_ui(ui, |ui| {
                for baud in &self.config.available_bauds {
                    let selected = self.config.baud_rate == *baud;
                    if ui.selectable_label(selected, baud.ui_text()).clicked() {
                        self.config.baud_rate = baud.clone();
                    }
                }
            });

        if let BaudRate::Custom(value) = &mut self.config.baud_rate {
            ui.add(
                DragValue::new(value)
                    .speed(100.0)
                    .range(1..=4_000_000)
                    .prefix("Custom: "),
            );
        }

        ui.add_space(8.0);

        ui.label("Data Bits");
        ComboBox::from_id_salt("serial_data_bits")
            .width(FIELD_WIDTH.min(ui.available_width()))
            .truncate()
            .selected_text(self.config.data_bits.to_string())
            .show_ui(ui, |ui| {
                for bits in SerialConfig::DATA_BITS {
                    if ui
                        .selectable_label(self.config.data_bits == *bits, bits.to_string())
                        .clicked()
                    {
                        self.config.data_bits = *bits;
                    }
                }
            });

        ui.label("Parity");
        render_named_value_combo(
            ui,
            "serial_parity",
            &mut self.config.parity,
            SerialConfig::PARITY,
        );

        ui.label("Flow Control");
        render_named_value_combo(
            ui,
            "serial_flow_control",
            &mut self.config.flow_control,
            SerialConfig::FLOW_CONTROL,
        );

        ui.label("Stop Bits");
        ComboBox::from_id_salt("serial_stop_bits")
            .width(FIELD_WIDTH.min(ui.available_width()))
            .truncate()
            .selected_text(self.config.stop_bits.to_string())
            .show_ui(ui, |ui| {
                for bits in SerialConfig::STOP_BITS {
                    if ui
                        .selectable_label(self.config.stop_bits == *bits, bits.to_string())
                        .clicked()
                    {
                        self.config.stop_bits = *bits;
                    }
                }
            });

        ui.label("Send Data Delay");
        render_named_value_combo(
            ui,
            "serial_send_delay",
            &mut self.config.send_data_delay,
            SerialConfig::DELAY,
        );

        ui.label("Exclusive");
        render_named_value_combo(
            ui,
            "serial_exclusive",
            &mut self.config.exclusive,
            SerialConfig::EXCLUSIVE,
        );

        self.config.validate();
    }
}

const FIELD_WIDTH: f32 = 180.0;

/// Renders a combo box for selecting one of the predefined named values.
fn render_named_value_combo<T: Copy + PartialEq>(
    ui: &mut Ui,
    id: impl std::hash::Hash,
    current: &mut NamedValue<T>,
    values: &[NamedValue<T>],
) {
    ComboBox::from_id_salt(id)
        .width(FIELD_WIDTH.min(ui.available_width()))
        .truncate()
        .selected_text(current.name)
        .show_ui(ui, |ui| {
            for item in values {
                if ui.selectable_label(*current == *item, item.name).clicked() {
                    *current = item.clone();
                }
            }
        });
}
