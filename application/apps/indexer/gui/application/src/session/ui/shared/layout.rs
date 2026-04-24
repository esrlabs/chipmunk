//! Shared UI layout state for a session.

use egui_table::Column;

/// Stores presentation state shared by multiple session UI components.
#[derive(Debug)]
pub struct UiLayoutState {
    /// Column definitions shared by the main logs table and the search results table.
    pub log_columns: Vec<Column>,
}
