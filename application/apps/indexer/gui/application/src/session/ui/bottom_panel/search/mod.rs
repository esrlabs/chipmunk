use tokio::sync::mpsc::Sender;

use egui::Ui;

use crate::{
    host::ui::UiActions,
    session::{command::SessionCommand, ui::shared::SessionShared},
};

use search_bar::SearchBar;
use search_table::SearchTable;

mod indexed_mapped;
mod search_bar;
mod search_table;

#[derive(Debug)]
pub struct SearchUI {
    pub bar: SearchBar,
    pub table: SearchTable,
}

impl SearchUI {
    pub fn new(cmd_tx: Sender<SessionCommand>) -> Self {
        Self {
            bar: SearchBar::new(cmd_tx.clone()),
            table: SearchTable::new(cmd_tx),
        }
    }
    pub fn render_content(
        &mut self,
        shared: &mut SessionShared,
        actions: &mut UiActions,
        ui: &mut Ui,
    ) {
        self.bar.render_content(shared, actions, ui);

        if shared.search.is_search_active() {
            // We need to give a unique id for the direct parent of each table because
            // they will be used as identifiers for table state to avoid ID clashes between
            // tables from different tabs (different sessions).
            ui.push_id(shared.get_id(), |ui| {
                self.table.render_content(shared, actions, ui);
            });
        }
    }
}
