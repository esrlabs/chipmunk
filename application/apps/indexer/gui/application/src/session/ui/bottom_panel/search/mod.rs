use egui::Ui;
use uuid::Uuid;

use crate::{
    host::ui::UiActions,
    session::{communication::UiSenders, data::SessionDataState, ui::state::SessionUiState},
};

use search_bar::SearchBar;
use search_table::SearchTable;

mod indexed_mapped;
mod search_bar;
mod search_table;

#[derive(Debug)]
pub struct SearchUI {
    session_id: Uuid,
    bar: SearchBar,
    table: SearchTable,
}

impl SearchUI {
    pub fn new(session_id: Uuid) -> Self {
        Self {
            session_id,
            bar: SearchBar::default(),
            table: SearchTable::default(),
        }
    }

    pub fn render_content(
        &mut self,
        data: &SessionDataState,
        ui_state: &mut SessionUiState,
        actions: &mut UiActions,
        senders: &UiSenders,
        ui: &mut Ui,
    ) {
        self.bar.render_content(data, senders, actions, ui);

        if data.search.is_search_active() {
            // We need to give a unique id for the direct parent of each table because
            // they will be used as identifiers for table state to avoid ID clashes between
            // tables from different tabs (different sessions).
            ui.push_id(self.session_id, |ui| {
                self.table
                    .render_content(data, ui_state, senders, actions, ui);
            });
        } else {
            self.table.clear();
        }
    }
}
