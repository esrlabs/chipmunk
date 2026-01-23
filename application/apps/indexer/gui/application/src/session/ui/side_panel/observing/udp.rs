use egui::Ui;

use crate::session::ui::shared::SessionShared;

pub fn render_content(_shared: &mut SessionShared, ui: &mut Ui) {
    super::render_group_title(ui, "UDP Connections");

    ui.centered_and_justified(|ui| ui.heading("UDP UI coming soon."));
}
