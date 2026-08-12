use std::fmt::Write as _;

use egui::{Button, Key, KeyboardShortcut, Modifiers, Ui};
use stypes::GrabbedElement;
use tokio::sync::mpsc::Sender;

use crate::{
    host::ui::UiActions,
    session::{
        command::SessionCommand,
        ui::{
            definitions::{LogTableCell, schema::LogSchema},
            shared::SessionShared,
        },
    },
};

const COPY_COLUMN_SEPARATOR: &str = " | ";

/// Platform copy command reserved for selected log rows.
pub const COPY_ROWS_SHORTCUT: KeyboardShortcut =
    KeyboardShortcut::new(Modifiers::COMMAND.plus(Modifiers::SHIFT), Key::C);

/// Controls which globally selected rows a table copies.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CopyScope {
    /// Copy every selected stream row.
    AllSelected,
    /// Copy selected rows that belong to the search table's logical contents.
    SearchRows,
}

/// Renders the selected-row clipboard action shared by both log tables.
pub fn render_copy_action(
    shared: &SessionShared,
    scope: CopyScope,
    actions: &mut UiActions,
    cmd_tx: &Sender<SessionCommand>,
    ui: &mut Ui,
) {
    let selected_count = selected_rows(shared, scope).count();
    let label = match selected_count {
        0 => String::from("Copy Selected Rows"),
        1 => String::from("Copy 1 Row"),
        count => format!("Copy {count} Rows"),
    };

    let shortcut_text = ui.ctx().format_shortcut(&COPY_ROWS_SHORTCUT);
    let button = Button::new(label).shortcut_text(shortcut_text);
    if ui.add_enabled(selected_count > 0, button).clicked() {
        copy_selected_rows(shared, scope, actions, cmd_tx);
        ui.close();
    }

    ui.separator();
}

/// Requests a copy for selected rows in the supplied table scope.
pub fn copy_selected_rows(
    shared: &SessionShared,
    scope: CopyScope,
    actions: &mut UiActions,
    cmd_tx: &Sender<SessionCommand>,
) -> bool {
    let rows = selected_rows(shared, scope).collect::<Vec<_>>();
    if rows.is_empty() {
        return false;
    }

    actions.try_send_command(cmd_tx, SessionCommand::CopyRows(rows));
    true
}

fn selected_rows(shared: &SessionShared, scope: CopyScope) -> impl Iterator<Item = u64> + '_ {
    shared.logs.selected_rows().filter(move |&row| match scope {
        CopyScope::AllSelected => true,
        CopyScope::SearchRows => shared.search.has_match(row) || shared.logs.is_bookmarked(row),
    })
}

/// Formats loaded stream rows as readable clipboard text.
pub fn format_rows(mut rows: Vec<GrabbedElement>, schema: &dyn LogSchema) -> String {
    rows.sort_unstable_by_key(|element| element.pos);

    let mut output = String::new();
    for (row_index, mut element) in rows.into_iter().enumerate() {
        if row_index > 0 {
            output.push('\n');
        }
        write!(output, "{}", element.pos).expect("writing to a String cannot fail");

        let mut ranges = schema.prepare_log(&mut element).into_iter();
        for _ in schema.columns() {
            output.push_str(COPY_COLUMN_SEPARATOR);

            let Some(range) = ranges.next() else {
                continue;
            };
            match LogTableCell::from_range(&element.content, range) {
                LogTableCell::Plain(range) => {
                    let text = element.content.get(range).unwrap_or_default();
                    append_field(&mut output, text);
                }
                LogTableCell::Ansi(ansi_text) => append_field(&mut output, &ansi_text.text),
            }
        }
    }

    output
}

fn append_field(output: &mut String, field: &str) {
    for character in field.chars() {
        match character {
            '\r' | '\n' => output.push(' '),
            _ => output.push(character),
        }
    }
}

#[cfg(test)]
mod tests {
    use std::{ops::Range, path::PathBuf};

    use egui_table::Column;
    use stypes::{FileFormat, FilterMatch, GrabbedElement, ObserveOrigin};
    use uuid::Uuid;

    use super::{CopyScope, format_rows, selected_rows};
    use crate::{
        host::common::parsers::ParserNames,
        session::{
            types::ObserveOperation,
            ui::{
                SessionInfo,
                definitions::schema::{
                    ColumnInfo, LogSchema, LogSchemaSpec, map_columns_with_separator,
                    text::TextLogSchema,
                },
                shared::SessionShared,
            },
        },
    };

    #[derive(Debug)]
    struct StructuredSchema {
        columns: [ColumnInfo; 3],
    }

    impl Default for StructuredSchema {
        fn default() -> Self {
            Self {
                columns: [
                    ColumnInfo::new("Time", "Time", Column::default()),
                    ColumnInfo::new("Level", "Level", Column::default()),
                    ColumnInfo::new("Message", "Message", Column::default()),
                ],
            }
        }
    }

    impl LogSchema for StructuredSchema {
        fn has_headers(&self) -> bool {
            true
        }

        fn columns(&self) -> &[ColumnInfo] {
            &self.columns
        }

        fn prepare_log(&self, element: &mut GrabbedElement) -> Vec<Range<usize>> {
            let mut ranges = Vec::new();
            map_columns_with_separator(&element.content, &mut ranges, "|");
            ranges
        }
    }

    fn element(pos: usize, content: &str) -> GrabbedElement {
        GrabbedElement {
            source_id: 0,
            content: content.to_owned(),
            pos,
            nature: 0,
        }
    }

    fn shared() -> SessionShared {
        let session_id = Uuid::new_v4();
        let origin = ObserveOrigin::File(
            "source".to_owned(),
            FileFormat::Text,
            PathBuf::from("source.log"),
        );
        let observe_op = ObserveOperation::new(Uuid::new_v4(), origin);
        let session_info = SessionInfo {
            id: session_id,
            title: "test".to_owned(),
            parser: ParserNames::Text,
            raw_export_supported: false,
        };

        SessionShared::new(session_info, observe_op, LogSchemaSpec::Text)
    }

    #[test]
    fn search_scope_includes_matches_and_bookmarks_only() {
        let mut shared = shared();
        shared.logs.replace_selection_with_rows(&[10, 20, 30, 40]);
        shared.insert_bookmark(20);
        shared.insert_bookmark(30);
        shared.search.set_search_operation(Uuid::new_v4());
        shared.search.append_matches(vec![
            FilterMatch {
                index: 10,
                filters: vec![0],
            },
            FilterMatch {
                index: 30,
                filters: vec![0],
            },
        ]);

        let mut rows = selected_rows(&shared, CopyScope::SearchRows).collect::<Vec<_>>();
        rows.sort_unstable();

        assert_eq!(rows, vec![10, 20, 30]);
    }

    #[test]
    fn plain_rows_are_sorted_and_prefixed_without_trailing_newline() {
        let rows = vec![element(42, "later"), element(3, "first")];

        let text = format_rows(rows, &TextLogSchema::default());

        assert_eq!(text, "3 | first\n42 | later");
        assert!(!text.ends_with('\n'));
    }

    #[test]
    fn structured_rows_include_defined_columns_without_headers_or_extra_fields() {
        let rows = vec![element(7, "12:00||started|unexpected")];

        let text = format_rows(rows, &StructuredSchema::default());

        assert_eq!(text, "7 | 12:00 |  | started");
        assert!(!text.contains("Time"));
        assert!(!text.contains("Level"));
        assert!(!text.contains("Message"));
        assert!(!text.contains("unexpected"));
    }

    #[test]
    fn ansi_is_stripped_and_embedded_line_breaks_become_spaces() {
        let rows = vec![element(9, "before\r\x1b[31mred\x1b[0m\nafter")];

        let text = format_rows(rows, &TextLogSchema::default());

        assert_eq!(text, "9 | before red after");
        assert!(!text.contains('\x1b'));
        assert_eq!(text.lines().count(), 1);
    }
}
