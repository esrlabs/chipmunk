use egui::{
    Align, Button, ComboBox, Frame, Label, Layout, Margin, Popup, RectAlign, RichText, TextEdit,
    Ui, Widget, vec2,
};

use crate::host::ui::session_setup::{
    start_session_on_enter,
    state::sources::{BaudRate, SerialConfig, serial::DEFAULT_BAUD_RATE},
};

use super::RenderOutcome;

const CONTROL_GROUP_WIDTH: f32 = 160.0;
const CONTROL_GROUP_SIDE_MARGIN: i8 = 5;
const CONTROL_WIDTH: f32 = CONTROL_GROUP_WIDTH - (CONTROL_GROUP_SIDE_MARGIN as f32 * 2.);

pub fn render_connection(config: &mut SerialConfig, ui: &mut Ui) -> RenderOutcome {
    config.check_update_ports();

    let mut outcome = RenderOutcome::None;
    let row_height = 25.0;

    ui.allocate_ui_with_layout(
        vec2(ui.available_width(), row_height),
        Layout::right_to_left(egui::Align::Center),
        |ui| render_port_path(config, &mut outcome, ui),
    );

    ui.separator();
    Label::new(RichText::new("Settings").heading().size(15.))
        .selectable(false)
        .ui(ui);

    ui.horizontal_wrapped(|ui| {
        ui.style_mut().spacing.combo_width = CONTROL_WIDTH;
        ui.style_mut().spacing.text_edit_width = CONTROL_WIDTH;

        labeled_field(ui, "Baud Rage", |ui| {
            ComboBox::from_id_salt("baud_rage")
                .selected_text(config.baud_rate.ui_text())
                .show_ui(ui, |ui| {
                    for rate in &config.available_bauds {
                        ui.selectable_value(&mut config.baud_rate, rate.to_owned(), rate.ui_text());
                    }
                });
        });

        if let BaudRate::Custom(baud_rate) = &mut config.baud_rate {
            labeled_field(ui, "Custom Baud Rate", |ui| {
                let mut baud_txt = baud_rate.to_string();
                let mut text_res = TextEdit::singleline(&mut baud_txt)
                    .desired_width(CONTROL_WIDTH)
                    .show(ui);
                if text_res.response.changed() {
                    if baud_txt.is_empty() {
                        *baud_rate = DEFAULT_BAUD_RATE;
                        // Removing last char position will move the cursor to end.
                        text_res.state.cursor.set_char_range(None);
                        text_res.state.store(ui.ctx(), text_res.response.id);
                    } else if let Ok(new_baud) = baud_txt.parse::<u32>() {
                        *baud_rate = new_baud;
                    }
                }
            });
        }

        labeled_field(ui, "Data Bits", |ui| {
            ComboBox::from_id_salt("data bits")
                .selected_text(config.data_bits.to_string())
                .show_ui(ui, |ui| {
                    for bits in SerialConfig::DATA_BITS {
                        ui.selectable_value(&mut config.data_bits, *bits, bits.to_string());
                    }
                });
        });

        labeled_field(ui, "Flow Control", |ui| {
            ComboBox::from_id_salt("flow control")
                .selected_text(config.flow_control.name)
                .show_ui(ui, |ui| {
                    for flow in SerialConfig::FLOW_CONTROL {
                        ui.selectable_value(&mut config.flow_control, flow.to_owned(), flow.name);
                    }
                });
        });

        labeled_field(ui, "parity", |ui| {
            ComboBox::from_id_salt("Parity")
                .selected_text(config.parity.name)
                .show_ui(ui, |ui| {
                    for parity in SerialConfig::PARITY {
                        ui.selectable_value(&mut config.parity, parity.to_owned(), parity.name);
                    }
                });
        });

        labeled_field(ui, "Stop Bits", |ui| {
            ComboBox::from_id_salt("stop bits")
                .selected_text(config.stop_bits.to_string())
                .show_ui(ui, |ui| {
                    for stop in SerialConfig::STOP_BITS {
                        ui.selectable_value(&mut config.stop_bits, *stop, stop.to_string());
                    }
                });
        });

        labeled_field(ui, "Exclusive opening", |ui| {
            ComboBox::from_id_salt("exclusive")
                .selected_text(config.exclusive.name)
                .show_ui(ui, |ui| {
                    for excl in SerialConfig::EXCLUSIVE {
                        ui.selectable_value(&mut config.exclusive, excl.to_owned(), excl.name);
                    }
                });
        });

        labeled_field(ui, "Delay on writing", |ui| {
            ComboBox::from_id_salt("delay writing")
                .selected_text(config.send_data_delay.name)
                .show_ui(ui, |ui| {
                    for delay in SerialConfig::DELAY {
                        ui.selectable_value(
                            &mut config.send_data_delay,
                            delay.to_owned(),
                            delay.name,
                        );
                    }
                });
        });
    });

    ui.add_space(10.);

    ui.allocate_ui_with_layout(
        vec2(ui.available_width(), 30.),
        Layout::right_to_left(Align::Center),
        |ui| {
            let btn_res = Button::new("Drop Settings to Defaults")
                .min_size(vec2(150., 25.))
                .ui(ui);
            if btn_res.clicked() {
                config.set_default_settings();
            }
        },
    );

    ui.add_space(5.);

    outcome
}

/// Renders the port selection menu and manual input field, handling validation and session startup triggers.
fn render_port_path(config: &mut SerialConfig, outcome: &mut RenderOutcome, ui: &mut Ui) {
    let height = ui.available_height();

    let ports_txt = format!("Detected ports ({})", config.available_ports.len());

    let button_res = Button::new(ports_txt).min_size(vec2(0., height)).ui(ui);

    let pop_id = egui::Id::new("ports");

    let mut path_changed = false;
    Popup::menu(&button_res)
        .id(pop_id)
        .align(RectAlign::BOTTOM_START)
        .show(|ui| {
            for port in &config.available_ports {
                if ui
                    .selectable_value(&mut config.path, port.to_owned(), port)
                    .changed()
                {
                    path_changed = true;
                }
            }
        });

    let path_res = TextEdit::singleline(&mut config.path)
        .min_size(vec2(ui.available_width(), height))
        .vertical_align(Align::Center)
        .hint_text("Port path")
        .show(ui)
        .response;

    if path_res.changed() {
        path_changed = true;
    }

    if path_changed {
        config.validate();
    }

    start_session_on_enter(&path_res, || config.is_valid(), outcome);
}

/// Renders a vertically stacked label and widget within a fixed-width container.
fn labeled_field(ui: &mut Ui, label: &str, add_widget: impl FnOnce(&mut Ui)) {
    ui.allocate_ui_with_layout(
        vec2(CONTROL_GROUP_WIDTH, 100.0),
        Layout::top_down_justified(Align::LEFT),
        |ui| {
            Frame::NONE
                .inner_margin(Margin::symmetric(CONTROL_GROUP_SIDE_MARGIN, 0))
                .show(ui, |ui| {
                    Label::new(label).selectable(false).ui(ui);
                    add_widget(ui);
                });
        },
    );
}
