use egui::Ui;

use crate::session::{communication::UiSenders, data::SessionState};

#[derive(Debug, Default)]
pub struct SearchUI;

impl SearchUI {
    pub fn render_content(&mut self, data: &SessionState, senders: &UiSenders, ui: &mut Ui) {
        ui.centered_and_justified(|ui| {
            ui.heading("Search UI");
        });
    }
}
