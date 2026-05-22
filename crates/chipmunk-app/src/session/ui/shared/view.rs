//! Shared UI view state for a session.

use std::ops::Not;

use egui_table::Column;

use crate::session::ui::{
    common::log_table::{self, LogTableKind},
    definitions::schema::LogSchema,
};

/// Stores view state shared by multiple session UI components.
#[derive(Debug)]
pub struct UiViewState {
    /// Column definitions shared by the main logs table and the search results table.
    pub log_columns: Vec<Column>,
    /// Log table currently targeted by table-level UI actions.
    pub active_log_table: LogTableKind,
}

impl UiViewState {
    pub fn new(schema: &dyn LogSchema) -> Self {
        Self {
            log_columns: log_table::table::create_table_columns(schema),
            active_log_table: LogTableKind::Main,
        }
    }

    /// Returns the log table that should receive table-level UI actions.
    pub fn log_table_target(&self, ctx: &egui::Context) -> Option<LogTableKind> {
        ctx.text_edit_focused()
            .not()
            .then_some(self.active_log_table)
    }
}
