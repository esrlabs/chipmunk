use std::rc::Rc;

use tokio::sync::mpsc::Sender;

use egui::{Frame, Margin, Ui};

use crate::{
    host::ui::{UiActions, registry::filters::FilterRegistry},
    session::{
        command::SessionCommand,
        types::OperationPhase,
        ui::{definitions::schema::LogSchema, shared::SessionShared},
    },
};

use nested_search::NestedSearch;
use search_bar::SearchBar;
use search_table::SearchTable;

mod nested_search;
mod search_bar;
mod search_table;

#[derive(Debug)]
pub struct SearchUI {
    pub bar: SearchBar,
    pub table: SearchTable,
    nested: NestedSearch,
}

impl SearchUI {
    pub fn new(cmd_tx: Sender<SessionCommand>, schema: Rc<dyn LogSchema>) -> Self {
        Self {
            bar: SearchBar::new(cmd_tx.clone()),
            table: SearchTable::new(cmd_tx.clone(), schema),
            nested: NestedSearch::new(cmd_tx),
        }
    }

    pub fn render_content(
        &mut self,
        shared: &mut SessionShared,
        actions: &mut UiActions,
        registry: &mut FilterRegistry,
        ui: &mut Ui,
    ) {
        Frame::NONE
            .inner_margin(Margin::symmetric(4, 1))
            .show(ui, |ui| {
                self.bar.render_content(shared, actions, registry, ui);
            });

        if self.table_available(shared) {
            // We need to give a unique id for the direct parent of each table because
            // they will be used as identifiers for table state to avoid ID clashes between
            // tables from different tabs (different sessions).
            ui.push_id(shared.get_id(), |ui| {
                let table_rect = self.table.render_content(shared, actions, registry, ui);
                if shared.search.nested().is_visible() {
                    self.nested.render(
                        shared.get_id(),
                        table_rect,
                        shared.search.nested_mut(),
                        actions,
                        ui,
                    );
                }
            });
        }
    }

    /// Opens nested search and requests focus for its input.
    pub fn open_nested(&mut self, shared: &mut SessionShared) {
        shared.search.nested_mut().open();
        self.nested.request_focus();
    }

    /// Closes nested search and clears both canonical and widget-local state.
    pub fn close_nested(&mut self, shared: &mut SessionShared) {
        shared.search.nested_mut().close();
        self.nested.reset();
    }

    /// Returns whether the indexed search-results table can currently be rendered.
    pub fn table_available(&self, shared: &SessionShared) -> bool {
        shared
            .search
            .search_operation_phase()
            .is_some_and(|phase| phase != OperationPhase::Initializing)
            || !shared.logs.bookmarked_rows.is_empty()
    }
}
