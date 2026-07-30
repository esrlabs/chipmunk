use std::rc::Rc;

use egui::{Context, Frame, Margin, Ui};
use tokio::sync::mpsc::Sender;
use uuid::Uuid;

use crate::{
    common::ui::visibility_tracker::VisibilityTracker,
    host::ui::{UiActions, registry::filters::FilterRegistry},
    session::{
        command::SessionCommand,
        types::OperationPhase,
        ui::{
            common::log_table::LogTableKind, definitions::schema::LogSchema, shared::SessionShared,
        },
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
    primary_focus_requested: bool,
    visibility_tracker: VisibilityTracker,
}

impl SearchUI {
    pub fn new(cmd_tx: Sender<SessionCommand>, schema: Rc<dyn LogSchema>) -> Self {
        Self {
            bar: SearchBar::new(cmd_tx.clone()),
            table: SearchTable::new(cmd_tx.clone(), schema),
            nested: NestedSearch::new(cmd_tx),
            primary_focus_requested: false,
            visibility_tracker: VisibilityTracker::default(),
        }
    }

    pub fn render_content(
        &mut self,
        shared: &mut SessionShared,
        actions: &mut UiActions,
        registry: &mut FilterRegistry,
        ui: &mut Ui,
    ) {
        let nested_visible = shared.search.nested().is_open() && self.table_available(shared);
        let newly_visible = self.visibility_tracker.is_newly_visible(ui);
        let primary_focus_requested = std::mem::take(&mut self.primary_focus_requested);
        if newly_visible && nested_visible && !primary_focus_requested {
            self.nested.focus_requested = true;
        }
        // Keep table focus only when nested search is not available to receive activation focus.
        let focus_primary = primary_focus_requested
            || (newly_visible
                && !nested_visible
                && shared.view.active_log_table != LogTableKind::Search);

        Frame::NONE
            .inner_margin(Margin::symmetric(4, 1))
            .show(ui, |ui| {
                self.bar
                    .render_content(shared, actions, registry, focus_primary, ui);
            });

        if self.table_available(shared) {
            // We need to give a unique id for the direct parent of each table because
            // they will be used as identifiers for table state to avoid ID clashes between
            // tables from different tabs (different sessions).
            ui.push_id(shared.get_id(), |ui| {
                let table_rect = self.table.render_content(shared, actions, registry, ui);
                if shared.search.nested().is_open() {
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
        self.focus_nested();
    }

    /// Requests focus for the primary search input.
    pub fn focus_primary(&mut self) {
        self.primary_focus_requested = true;
        // Ensure the newer primary request wins in race conditions.
        self.nested.focus_requested = false;
    }

    /// Requests focus for the nested-search input.
    pub fn focus_nested(&mut self) {
        self.primary_focus_requested = false;
        self.nested.focus_requested = true;
    }

    /// Returns whether the nested-search input owns keyboard focus.
    pub fn nested_focused(&self, session_id: Uuid, ctx: &Context) -> bool {
        self.nested.has_focus(session_id, ctx)
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

#[cfg(test)]
mod tests {
    use std::{path::PathBuf, rc::Rc};

    use egui::{Context, Id, RawInput, TextEdit};
    use stypes::{FileFormat, ObserveOrigin};
    use tokio::{runtime::Runtime, sync::mpsc};
    use uuid::Uuid;

    use super::SearchUI;
    use crate::{
        host::{
            common::parsers::ParserNames,
            ui::{UiActions, registry::filters::FilterRegistry},
        },
        session::{
            types::ObserveOperation,
            ui::{SessionInfo, definitions::schema::LogSchemaSpec, shared::SessionShared},
        },
    };

    fn new_shared() -> SessionShared {
        let session_info = SessionInfo {
            id: Uuid::new_v4(),
            title: "test".to_owned(),
            parser: ParserNames::Text,
            raw_export_supported: false,
        };
        let observe_op = ObserveOperation::new(
            Uuid::new_v4(),
            ObserveOrigin::File(
                "source".to_owned(),
                FileFormat::Text,
                PathBuf::from("source.log"),
            ),
        );

        SessionShared::new(session_info, observe_op, LogSchemaSpec::Text)
    }

    fn render(
        search: &mut SearchUI,
        shared: &mut SessionShared,
        actions: &mut UiActions,
        registry: &mut FilterRegistry,
        ctx: &Context,
    ) {
        let _ = ctx.run_ui(RawInput::default(), |ui| {
            search.render_content(shared, actions, registry, ui);
        });
    }

    #[test]
    fn returning_to_nested_search_focuses_it_over_the_search_table() {
        let runtime = Runtime::new().expect("runtime should initialize");
        let mut actions = UiActions::new(runtime.handle().clone());
        let mut registry = FilterRegistry::default();
        let mut shared = new_shared();
        shared.insert_bookmark(1);
        let (cmd_tx, _cmd_rx) = mpsc::channel(1);
        let mut search = SearchUI::new(cmd_tx, Rc::clone(&shared.schema));
        let ctx = Context::default();

        render(&mut search, &mut shared, &mut actions, &mut registry, &ctx);
        let _ = ctx.run_ui(RawInput::default(), |_| {});
        shared.search.nested_mut().open();
        shared.view.active_log_table = super::LogTableKind::Search;

        render(&mut search, &mut shared, &mut actions, &mut registry, &ctx);
        render(&mut search, &mut shared, &mut actions, &mut registry, &ctx);

        assert!(search.nested_focused(shared.get_id(), &ctx));
    }

    #[test]
    fn explicit_primary_focus_overrides_nested_activation_focus() {
        let runtime = Runtime::new().expect("runtime should initialize");
        let mut actions = UiActions::new(runtime.handle().clone());
        let mut registry = FilterRegistry::default();
        let mut shared = new_shared();
        shared.insert_bookmark(1);
        let (cmd_tx, _cmd_rx) = mpsc::channel(1);
        let mut search = SearchUI::new(cmd_tx, Rc::clone(&shared.schema));
        let ctx = Context::default();

        render(&mut search, &mut shared, &mut actions, &mut registry, &ctx);
        let _ = ctx.run_ui(RawInput::default(), |_| {});
        shared.search.nested_mut().open();
        search.focus_nested();
        search.focus_primary();

        render(&mut search, &mut shared, &mut actions, &mut registry, &ctx);
        render(&mut search, &mut shared, &mut actions, &mut registry, &ctx);

        assert!(ctx.text_edit_focused());
        assert!(!search.nested_focused(shared.get_id(), &ctx));
    }

    #[test]
    fn active_search_table_preserves_focus_without_nested_search() {
        let runtime = Runtime::new().expect("runtime should initialize");
        let mut actions = UiActions::new(runtime.handle().clone());
        let mut registry = FilterRegistry::default();
        let mut shared = new_shared();
        shared.insert_bookmark(1);
        let (cmd_tx, _cmd_rx) = mpsc::channel(1);
        let mut search = SearchUI::new(cmd_tx, Rc::clone(&shared.schema));
        let ctx = Context::default();

        render(&mut search, &mut shared, &mut actions, &mut registry, &ctx);
        let _ = ctx.run_ui(RawInput::default(), |_| {});
        shared.view.active_log_table = super::LogTableKind::Search;
        let table_focus = Id::new("active_search_table");
        let mut table_editor = String::new();
        let _ = ctx.run_ui(RawInput::default(), |ui| {
            TextEdit::singleline(&mut table_editor)
                .id(table_focus)
                .show(ui)
                .response
                .request_focus();
            search.render_content(&mut shared, &mut actions, &mut registry, ui);
        });

        assert_eq!(ctx.memory(|memory| memory.focused()), Some(table_focus));
    }
}
