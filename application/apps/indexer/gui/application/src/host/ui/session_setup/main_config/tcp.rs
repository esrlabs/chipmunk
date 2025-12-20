use egui::{Align, Color32, Key, Label, RichText, TextEdit, Ui, Widget};

use crate::host::ui::session_setup::state::sources::TcpConfig;

use super::RenderOutcome;

pub fn render_connection(config: &mut TcpConfig, ui: &mut Ui) -> RenderOutcome {
    let mut outcome = RenderOutcome::None;
    ui.vertical(|ui| {
        Label::new("Socket Address:").selectable(false).ui(ui);

        let ip_txt_res = TextEdit::singleline(&mut config.bind_addr)
            .vertical_align(Align::Center)
            .desired_width(200.)
            .hint_text("127.0.0.1:8080")
            .show(ui)
            .response;

        if ip_txt_res.changed() {
            config.validate();
        }

        if ip_txt_res.lost_focus() && ip_txt_res.ctx.input(|ui| ui.key_pressed(Key::Enter)) {
            if config.is_valid() {
                outcome = RenderOutcome::StartSession;
            } else {
                // Single line moves focus on enter. This is a quick fix
                // in case command isn't valid.
                ip_txt_res.request_focus();
            }
        }

        ui.vertical(|ui| {
            ui.set_height(20.);
            if let Some(err_msg) = config.get_err_msg() {
                let err_txt = RichText::new(err_msg)
                    .size(10.5)
                    .small()
                    .color(Color32::YELLOW);
                Label::new(err_txt).selectable(false).ui(ui);
            }
        });
    });

    outcome
}
