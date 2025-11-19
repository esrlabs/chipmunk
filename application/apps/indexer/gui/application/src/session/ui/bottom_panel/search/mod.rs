use tokio::sync::mpsc::Sender;

use egui::Ui;

use crate::{
    host::ui::UiActions,
    session::{
        command::{SessionBlockingCommand, SessionCommand},
        data::SessionDataState,
        ui::state::SessionUiState,
    },
};

use search_bar::SearchBar;
use search_table::SearchTable;

mod indexed_mapped;
mod search_bar;
mod search_table;

#[derive(Debug)]
pub struct SearchUI {
    bar: SearchBar,
    table: SearchTable,
}

impl SearchUI {
    pub fn new(
        cmd_tx: Sender<SessionCommand>,
        block_cmd_tx: Sender<SessionBlockingCommand>,
    ) -> Self {
        Self {
            bar: SearchBar::new(cmd_tx.clone()),
            table: SearchTable::new(cmd_tx, block_cmd_tx),
        }
    }
    pub fn render_content(
        &mut self,
        data: &SessionDataState,
        ui_state: &mut SessionUiState,
        actions: &mut UiActions,
        ui: &mut Ui,
    ) {
        self.bar.render_content(data, actions, ui);

        if data.search.is_search_active() {
            // We need to give a unique id for the direct parent of each table because
            // they will be used as identifiers for table state to avoid ID clashes between
            // tables from different tabs (different sessions).
            ui.push_id(data.session_id, |ui| {
                self.table.render_content(data, ui_state, actions, ui);
            });
        } else {
            self.table.clear();
        }
    }
}
