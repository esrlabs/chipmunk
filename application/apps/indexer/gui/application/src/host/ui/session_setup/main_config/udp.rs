use egui::{Align, Button, Label, Layout, Response, RichText, Sides, TextEdit, Ui, Widget, vec2};

use crate::{
    common::phosphor::icons,
    host::ui::session_setup::state::sources::{MulticastItem, UdpConfig},
};

use super::{ConfigBindAddress, RenderOutcome, render_socket_address};

impl ConfigBindAddress for UdpConfig {
    fn bind_addr(&mut self) -> &mut String {
        &mut self.bind_addr
    }

    fn validate(&mut self) {
        self.validate();
    }

    fn is_valid(&self) -> bool {
        self.is_valid()
    }

    fn bind_err_msg(&self) -> Option<&str> {
        self.get_bind_err()
    }
}

pub fn render_connection(config: &mut UdpConfig, ui: &mut Ui) -> RenderOutcome {
    let outcome = render_socket_address(config, ui);

    if !config.multicasts.is_empty() {
        render_multicasts(config, ui);
    }

    ui.allocate_ui_with_layout(
        vec2(ui.available_width(), 30.),
        Layout::right_to_left(Align::Center),
        |ui| {
            let multi_res = Button::new("Add Multicast")
                .min_size(vec2(100., 20.))
                .ui(ui);

            if multi_res.clicked() {
                config.multicasts.push(MulticastItem::new());
            }
        },
    );

    outcome
}

pub fn render_multicasts(config: &mut UdpConfig, ui: &mut Ui) {
    ui.separator();
    ui.heading("Multicasts");

    let mut to_delete = None;
    for (idx, item) in config.multicasts.iter_mut().enumerate() {
        Sides::new().height(50.0).shrink_left().truncate().show(
            ui,
            |ui| {
                // Calculate the width for input fields manually to ensure
                // they will align with close button correctly in both session setup
                // and observe side view form within the session.
                let available_width = ui.available_width();
                let width = (available_width / 2.2).min(200.0);

                let multi_res = label_input_field(
                    ui,
                    "Address",
                    &mut item.multi_address,
                    "255.255.255.255",
                    item.multi_address_err,
                    width,
                );

                let inter_res = label_input_field(
                    ui,
                    "Interface Address",
                    &mut item.interface_addr,
                    "0.0.0.0",
                    item.interface_addr_err,
                    width,
                );

                if multi_res.changed() || inter_res.changed() {
                    item.validate();
                }
            },
            |ui| {
                ui.add_space(10.);
                let button_res = Button::new(icons::regular::X)
                    .frame(false)
                    .ui(ui)
                    .on_hover_text("Remove");

                if button_res.clicked() {
                    to_delete = Some(idx);
                }
            },
        );
    }

    if let Some(to_del) = to_delete {
        config.multicasts.remove(to_del);
    }
}

fn label_input_field(
    ui: &mut Ui,
    label: &str,
    value: &mut String,
    hint_text: &str,
    error_msg: Option<&str>,
    width: f32,
) -> Response {
    ui.with_layout(Layout::top_down(Align::LEFT), |ui| {
        ui.style_mut().spacing.item_spacing.y += 2.;

        ui.label(label);

        let input_res = TextEdit::singleline(value)
            .desired_width(width)
            .hint_text(hint_text)
            .ui(ui);

        if let Some(msg) = error_msg {
            let txt = RichText::new(msg)
                .small()
                .size(11.)
                .color(ui.visuals().warn_fg_color);

            Label::new(txt).selectable(true).ui(ui);
        }

        input_res
    })
    .inner
}
