use egui::Ui;

use crate::session::data::SessionDataState;

pub fn render_content(data: &SessionDataState, ui: &mut Ui) {
    egui::Sides::new().show(
        ui,
        |ui| {
            ui.label(format!("Total logs count: {}", data.logs_count));
        },
        |ui| {
            ui.label("TODO: Running session status");
        },
    );
}
