use egui::Ui;

use crate::session::{communication::UiSenders, data::SessionState};

use search_bar::SearchBar;

mod search_bar;

#[derive(Debug, Default)]
pub struct SearchUI {
    bar: SearchBar,
}

impl SearchUI {
    pub fn render_content(&mut self, data: &SessionState, senders: &UiSenders, ui: &mut Ui) {
        self.bar.render_content(senders, ui);
        ui.centered_and_justified(|ui| {
            ui.heading("Search UI");
        });
    }
}
