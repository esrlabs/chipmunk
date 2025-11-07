use egui::Ui;

use crate::session::{communication::UiSenders, data::SessionDataState, ui::state::SessionUiState};

#[derive(Debug, Default)]
pub struct DetailsUI;

impl DetailsUI {
    pub fn render_content(
        &mut self,
        data: &SessionDataState,
        ui_state: &SessionUiState,
        senders: &UiSenders,
        ui: &mut Ui,
    ) {
        ui.centered_and_justified(|ui| {
            ui.heading("Details UI");
        });
    }
}
