use egui::Ui;

use crate::session::ui::shared::SessionShared;

pub fn render_content(shared: &SessionShared, ui: &mut Ui) {
    egui::Sides::new().show(
        ui,
        |ui| {
            ui.label(format!("Total logs count: {}", shared.logs.logs_count));
        },
        |ui| {
            ui.label("TODO: Running session status");
        },
    );
}
