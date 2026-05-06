//! Text export modal workflow data.
//!
//! Rendering lives in `session/ui/export_modal.rs`; this module only stores the
//! pending target and converts confirmed modal state into export options.

use crate::session::{
    command::{ExportTarget, TextExportOptions},
    ui::definitions::schema::LogSchema,
};

const DEFAULT_DELIMITER: &str = ";";

/// Pending modal state for DLT/SomeIP text export.
#[derive(Debug)]
pub struct TextExportModalState {
    /// Rows or indexed/all range to export after confirmation.
    target: ExportTarget,
    /// Modal and following save-dialog title.
    pub title: &'static str,
    /// Snapshot of schema columns available when the modal opened.
    pub columns: Vec<TextExportColumn>,
    /// Separator used to join exported columns after filtering.
    pub delimiter: String,
    /// Save dialog id to open after confirmation.
    dialog_id: &'static str,
    /// Suggested save-dialog file name.
    file_name: String,
}

/// One selectable text-export table column.
#[derive(Debug)]
pub struct TextExportColumn {
    index: usize,
    pub label: String,
    pub tooltip: String,
    pub selected: bool,
}

/// Validation failure for text table-export options.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TextExportValidationError {
    NoColumnsSelected,
    EmptyDelimiter,
    DelimiterContainsNewline,
}

/// Confirmed text export modal request ready to open a save dialog.
#[derive(Debug)]
pub struct TextExportRequest {
    /// Rows or indexed/all range to export.
    pub target: ExportTarget,
    /// Text export options derived from the modal state.
    pub options: TextExportOptions,
    /// Save-dialog title.
    pub title: &'static str,
    /// Save dialog id used to collect the matching async output.
    pub dialog_id: &'static str,
    /// Suggested save-dialog file name.
    pub file_name: String,
}

impl TextExportModalState {
    /// Creates modal state using all columns from the active schema.
    pub fn new(
        target: ExportTarget,
        title: &'static str,
        schema: &dyn LogSchema,
        dialog_id: &'static str,
        file_name: String,
    ) -> Self {
        let columns = schema
            .columns()
            .iter()
            .enumerate()
            .map(|(index, column)| TextExportColumn {
                index,
                label: column.header.to_string(),
                tooltip: column.header_tooltip.to_string(),
                selected: true,
            })
            .collect();

        Self {
            target,
            title,
            columns,
            delimiter: DEFAULT_DELIMITER.to_owned(),
            dialog_id,
            file_name,
        }
    }

    /// Returns current validation failures.
    pub fn validation_errors(&self) -> Vec<TextExportValidationError> {
        let mut errors = Vec::new();

        if !self.columns.iter().any(|column| column.selected) {
            errors.push(TextExportValidationError::NoColumnsSelected);
        }

        if self.delimiter.is_empty() {
            errors.push(TextExportValidationError::EmptyDelimiter);
        }

        if self.delimiter.contains(['\n', '\r']) {
            errors.push(TextExportValidationError::DelimiterContainsNewline);
        }

        errors
    }

    /// Consumes confirmed modal state and creates a save-dialog request.
    pub fn export_request(self) -> Option<TextExportRequest> {
        if !self.validation_errors().is_empty() {
            return None;
        }

        let columns = self
            .columns
            .into_iter()
            .filter_map(|column| column.selected.then_some(column.index))
            .collect();

        Some(TextExportRequest {
            target: self.target,
            options: TextExportOptions::Table {
                columns,
                delimiter: self.delimiter,
            },
            title: self.title,
            dialog_id: self.dialog_id,
            file_name: self.file_name,
        })
    }
}

#[cfg(test)]
mod tests {
    use std::ops::Range;

    use egui_table::Column;
    use stypes::GrabbedElement;

    use super::*;
    use crate::session::ui::definitions::schema::ColumnInfo;

    #[derive(Debug)]
    struct TestSchema {
        columns: [ColumnInfo; 3],
    }

    impl Default for TestSchema {
        fn default() -> Self {
            Self {
                columns: [
                    ColumnInfo::new("first", "first tip", Column::default()),
                    ColumnInfo::new("second", "second tip", Column::default()),
                    ColumnInfo::new("third", "third tip", Column::default()),
                ],
            }
        }
    }

    impl LogSchema for TestSchema {
        fn has_headers(&self) -> bool {
            true
        }

        fn columns(&self) -> &[ColumnInfo] {
            &self.columns
        }

        fn prepare_log(&self, element: &mut GrabbedElement) -> Vec<Range<usize>> {
            vec![0..element.content.len()]
        }
    }

    fn modal() -> TextExportModalState {
        TextExportModalState::new(
            ExportTarget::All,
            "Export",
            &TestSchema::default(),
            "dialog",
            "export.txt".to_owned(),
        )
    }

    fn table_options(modal: TextExportModalState) -> (Vec<usize>, String) {
        let request = modal.export_request().expect("valid export request");
        match request.options {
            TextExportOptions::Table { columns, delimiter } => (columns, delimiter),
            TextExportOptions::FullRows => panic!("expected table export options"),
        }
    }

    #[test]
    fn default_modal_selects_all_schema_columns() {
        let modal = modal();

        let (columns, delimiter) = table_options(modal);

        assert_eq!(columns, vec![0, 1, 2]);
        assert_eq!(delimiter, ";");
    }

    #[test]
    fn empty_delimiter_blocks_export() {
        let mut modal = modal();
        modal.delimiter.clear();

        assert_eq!(
            modal.validation_errors(),
            vec![TextExportValidationError::EmptyDelimiter]
        );
        assert!(modal.export_request().is_none());
    }

    #[test]
    fn newline_delimiter_blocks_export() {
        let mut modal = modal();
        modal.delimiter = "a\nb".to_owned();

        assert_eq!(
            modal.validation_errors(),
            vec![TextExportValidationError::DelimiterContainsNewline]
        );
        assert!(modal.export_request().is_none());
    }

    #[test]
    fn carriage_return_delimiter_blocks_export() {
        let mut modal = modal();
        modal.delimiter = "a\rb".to_owned();

        assert_eq!(
            modal.validation_errors(),
            vec![TextExportValidationError::DelimiterContainsNewline]
        );
        assert!(modal.export_request().is_none());
    }

    #[test]
    fn whitespace_delimiter_is_accepted() {
        let mut modal = modal();
        modal.delimiter = " ".to_owned();

        let (columns, delimiter) = table_options(modal);

        assert_eq!(columns, vec![0, 1, 2]);
        assert_eq!(delimiter, " ");
    }

    #[test]
    fn selected_subset_exports_indexes_in_schema_order() {
        let mut modal = modal();
        modal.columns[0].selected = false;
        modal.columns[2].selected = false;

        let (columns, delimiter) = table_options(modal);

        assert_eq!(columns, vec![1]);
        assert_eq!(delimiter, ";");
    }

    #[test]
    fn no_selected_columns_blocks_export() {
        let mut modal = modal();
        for column in &mut modal.columns {
            column.selected = false;
        }

        assert_eq!(
            modal.validation_errors(),
            vec![TextExportValidationError::NoColumnsSelected]
        );
        assert!(modal.export_request().is_none());
    }
}
