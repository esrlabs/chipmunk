use egui::{Layout, Ui, UiBuilder};

use crate::{
    host::ui::UiActions,
    session::{communication::UiSenders, data::SessionState},
};

use search_bar::SearchBar;
use search_table::SearchTable;

mod search_bar;
mod search_table;

#[derive(Debug, Default)]
pub struct SearchUI {
    bar: SearchBar,
    table: SearchTable,
}

impl SearchUI {
    pub fn render_content(
        &mut self,
        data: &SessionState,
        actions: &mut UiActions,
        senders: &UiSenders,
        ui: &mut Ui,
    ) {
        self.bar.render_content(data, senders, actions, ui);
        if data.search.is_search_active() {
            self.table.render_content(data, senders, ui);
        } else {
            ui.centered_and_justified(|ui| {
                ui.heading("Search UI");
            });
        }
    }
}
