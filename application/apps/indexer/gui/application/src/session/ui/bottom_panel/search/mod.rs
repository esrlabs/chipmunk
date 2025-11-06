use egui::Ui;
use uuid::Uuid;

use crate::{
    host::ui::UiActions,
    session::{
        communication::UiSenders, data::SessionState,
        ui::bottom_panel::search::search_bar::SearchEvent,
    },
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
        data: &SessionState,
        actions: &mut UiActions,
        senders: &UiSenders,
        ui: &mut Ui,
    ) {
        match self.bar.render_content(data, senders, actions, ui) {
            Some(SearchEvent::SearchDropped) => {
                self.table.reset();
                // Avoid rendering table if search is dropped in this frame
                // to avoid it requesting data which doesn't exist in session
                // but still exist in the session data state because we are still
                // holding its reference in this frame.
                return;
            }
            None => {}
        };

        if data.search.is_search_active() {
            // We need to give a unique id for the direct parent of each table because
            // they will be used as identifiers for table state to avoid ID clashes between
            // tables from different tabs (different sessions).
            ui.push_id(self.session_id, |ui| {
                self.table.render_content(data, senders, ui);
            });
        }
    }
}
