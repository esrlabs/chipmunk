use egui::Ui;

use crate::session::{communication::UiSenders, data::SessionDataState};

#[derive(Debug, Default)]
pub struct ChartUI;

impl ChartUI {
    pub fn render_content(&mut self, data: &SessionDataState, senders: &UiSenders, ui: &mut Ui) {
        ui.centered_and_justified(|ui| {
            ui.heading("Charts UI");
        });
    }
}
