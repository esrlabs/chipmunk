use egui::Ui;

use crate::{
    host::ui::UiActions,
    session::{communication::UiSenders, data::SessionState},
};

use search_bar::SearchBar;

mod search_bar;

#[derive(Debug, Default)]
pub struct SearchUI {
    bar: SearchBar,
}

impl SearchUI {
    pub fn render_content(
        &mut self,
        data: &SessionState,
        actions: &mut UiActions,
        senders: &UiSenders,
        ui: &mut Ui,
    ) {
        self.bar.render_content(senders, actions, ui);
        ui.centered_and_justified(|ui| {
            ui.heading("Search UI");
        });
    }
}
