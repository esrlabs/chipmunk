//! Session-owned Jump to Row input overlay.

use egui::{Align2, Event, Key, Modifiers, Order, Ui, Window, pos2, vec2};

use crate::host::common::ui_utls::{
    clicked_outside_rect, show_validation_message, sized_singleline_text_edit,
};

use super::shared::{SearchTableSync, SessionShared};

/// Lightweight overlay for selecting a zero-based session row.
#[derive(Debug, Default)]
pub struct JumpToRow {
    open: bool,
    input: String,
    first_open_frame: bool,
    show_validation: bool,
}

impl JumpToRow {
    /// Opens a fresh row input session unless the overlay is already open.
    pub fn open(&mut self) {
        let Self {
            open,
            input,
            first_open_frame,
            show_validation,
        } = self;

        if *open {
            return;
        }

        *open = true;
        input.clear();
        *first_open_frame = true;
        *show_validation = false;
    }

    /// Returns whether the overlay is visible.
    pub fn is_open(&self) -> bool {
        self.open
    }

    /// Closes the overlay and discards its input.
    pub fn close(&mut self) {
        let Self {
            open,
            input,
            first_open_frame,
            show_validation,
        } = self;

        *open = false;
        input.clear();
        *first_open_frame = false;
        *show_validation = false;
    }

    /// Handles overlay input and renders the open overlay.
    pub fn render(&mut self, shared: &mut SessionShared, parent_ui: &Ui) {
        if parent_ui.input_mut(|input| input.consume_key(Modifiers::NONE, Key::Escape)) {
            self.close();
            return;
        }

        let logs_count = shared.logs.logs_count();
        if consume_enter(parent_ui) {
            self.show_validation = true;

            if let RowValidation::Valid(row) = validate_row(&self.input, logs_count) {
                shared.logs.focus_main_row(row, SearchTableSync::Sync);
                self.close();
                return;
            }
        }

        self.render_window(parent_ui, logs_count);
    }

    fn render_window(&mut self, parent_ui: &Ui, logs_count: u64) {
        const PANEL_WIDTH: f32 = 320.0;
        const PANEL_TOP_OFFSET: f32 = 90.0;

        let screen_rect = parent_ui.ctx().content_rect();
        let panel_pos = pos2(screen_rect.center().x, screen_rect.top() + PANEL_TOP_OFFSET);
        let window_id = parent_ui.make_persistent_id("jump_to_row_window");
        let first_open_frame = self.first_open_frame;
        let window_response = Window::new("jump_to_row")
            .id(window_id)
            .order(Order::Foreground)
            .title_bar(false)
            .collapsible(false)
            .resizable(false)
            .scroll(false)
            .fixed_pos(panel_pos)
            .pivot(Align2::CENTER_TOP)
            .show(parent_ui.ctx(), |ui| {
                ui.set_width(PANEL_WIDTH);
                ui.heading("Jump to Row");

                let input_id = ui.make_persistent_id("jump_to_row_input");
                let input_response = sized_singleline_text_edit(
                    ui,
                    &mut self.input,
                    vec2(ui.available_width(), 25.0),
                    7,
                )
                .id(input_id)
                .hint_text("Enter row number")
                .lock_focus(true)
                .show(ui)
                .response;

                if first_open_frame {
                    input_response.request_focus();
                }
                if input_response.changed() {
                    self.show_validation = true;
                }

                let validation_message = self.validation_message(logs_count);
                show_validation_message(ui, validation_message);

                ui.label("Enter to jump, Esc to cancel");
            });
        self.first_open_frame = false;

        let clicked_outside = window_response
            .as_ref()
            .is_some_and(|response| clicked_outside_rect(parent_ui, response.response.rect));
        if !first_open_frame && clicked_outside {
            self.close();
        }
    }

    fn validation_message(&self, logs_count: u64) -> Option<&'static str> {
        if !self.show_validation {
            return None;
        }

        validate_row(&self.input, logs_count).message()
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum RowValidation {
    InvalidInput,
    OutOfBounds,
    Valid(u64),
}

impl RowValidation {
    fn message(self) -> Option<&'static str> {
        match self {
            Self::InvalidInput => Some("Enter a valid row number."),
            Self::OutOfBounds => Some("Row is out of bounds."),
            Self::Valid(_) => None,
        }
    }
}

fn validate_row(input: &str, logs_count: u64) -> RowValidation {
    match input.parse::<u64>() {
        Ok(row) if row < logs_count => RowValidation::Valid(row),
        Ok(_) => RowValidation::OutOfBounds,
        Err(_) => RowValidation::InvalidInput,
    }
}

fn consume_enter(ui: &Ui) -> bool {
    ui.input_mut(|input| {
        let mut consumed = false;
        input.events.retain(|event| {
            let matched = matches!(
                event,
                Event::Key {
                    key: Key::Enter,
                    pressed: true,
                    ..
                }
            );
            consumed |= matched;
            !matched
        });
        consumed
    })
}

#[cfg(test)]
mod tests {
    use std::path::PathBuf;

    use egui::{Context, Event, Key, Modifiers, PointerButton, RawInput, Rect, pos2, vec2};
    use stypes::{FileFormat, ObserveOrigin};
    use uuid::Uuid;

    use super::{JumpToRow, RowValidation, validate_row};
    use crate::{
        host::common::parsers::ParserNames,
        session::{
            types::ObserveOperation,
            ui::{
                SessionInfo,
                definitions::schema::LogSchemaSpec,
                shared::{SearchTableSync, SessionShared},
            },
        },
    };

    fn new_shared(logs_count: u64) -> SessionShared {
        let origin = ObserveOrigin::File(
            "source".to_owned(),
            FileFormat::Text,
            PathBuf::from("source.log"),
        );
        let observe_op = ObserveOperation::new(Uuid::new_v4(), origin);
        let session_info = SessionInfo {
            id: Uuid::new_v4(),
            title: "test".to_owned(),
            parser: ParserNames::Text,
            raw_export_supported: false,
        };
        let mut shared = SessionShared::new(session_info, observe_op, LogSchemaSpec::Text);
        shared.logs.set_logs_count(logs_count);
        shared
    }

    fn key_input(key: Key, modifiers: Modifiers) -> RawInput {
        RawInput {
            events: vec![Event::Key {
                key,
                physical_key: Some(key),
                pressed: true,
                repeat: false,
                modifiers,
            }],
            ..Default::default()
        }
    }

    fn render(jump: &mut JumpToRow, shared: &mut SessionShared, input: RawInput) {
        let ctx = Context::default();
        let _ = ctx.run_ui(input, |ui| jump.render(shared, ui));
    }

    fn pointer_input(pressed: bool) -> RawInput {
        let pos = pos2(10.0, 10.0);
        RawInput {
            screen_rect: Some(Rect::from_min_size(pos2(0.0, 0.0), vec2(800.0, 600.0))),
            events: vec![
                Event::PointerMoved(pos),
                Event::PointerButton {
                    pos,
                    button: PointerButton::Primary,
                    pressed,
                    modifiers: Modifiers::NONE,
                },
            ],
            ..Default::default()
        }
    }

    #[test]
    fn opening_starts_with_fresh_input() {
        let mut jump = JumpToRow::default();
        jump.input = "stale".to_owned();

        jump.open();
        assert!(jump.is_open());
        assert!(jump.input.is_empty());

        jump.input = "in progress".to_owned();
        jump.open();
        assert_eq!(jump.input, "in progress");

        jump.close();
        jump.open();
        assert!(jump.input.is_empty());
    }

    #[test]
    fn validation_classifies_raw_input_and_boundaries() {
        for (input, logs_count, expected) in [
            ("", 10, RowValidation::InvalidInput),
            ("text", 10, RowValidation::InvalidInput),
            ("-1", 10, RowValidation::InvalidInput),
            (" 4", 10, RowValidation::InvalidInput),
            ("4 ", 10, RowValidation::InvalidInput),
            ("18446744073709551616", 10, RowValidation::InvalidInput),
            ("0", 0, RowValidation::OutOfBounds),
            ("0", 1, RowValidation::Valid(0)),
            ("+4", 10, RowValidation::Valid(4)),
            ("9", 10, RowValidation::Valid(9)),
            ("10", 10, RowValidation::OutOfBounds),
        ] {
            assert_eq!(
                validate_row(input, logs_count),
                expected,
                "input: {input:?}"
            );
        }
    }

    #[test]
    fn validation_stays_hidden_until_edit_or_submit() {
        let mut jump = JumpToRow::default();
        let mut shared = new_shared(10);
        let ctx = Context::default();
        jump.open();

        let _ = ctx.run_ui(RawInput::default(), |ui| jump.render(&mut shared, ui));
        assert!(jump.validation_message(10).is_none());

        let text_input = RawInput {
            events: vec![Event::Text("x".to_owned())],
            ..Default::default()
        };
        let _ = ctx.run_ui(text_input, |ui| jump.render(&mut shared, ui));
        assert_eq!(jump.input, "x");
        assert!(jump.validation_message(10).is_some());

        let _ = ctx.run_ui(key_input(Key::Backspace, Modifiers::NONE), |ui| {
            jump.render(&mut shared, ui)
        });
        assert!(jump.input.is_empty());
        assert!(jump.validation_message(10).is_some());

        let text_input = RawInput {
            events: vec![Event::Text("4".to_owned())],
            ..Default::default()
        };
        let _ = ctx.run_ui(text_input, |ui| jump.render(&mut shared, ui));
        assert_eq!(jump.input, "4");
        assert!(jump.validation_message(10).is_none());
    }

    #[test]
    fn enter_modifiers_use_the_same_submission_path() {
        for modifiers in [
            Modifiers::NONE,
            Modifiers::CTRL,
            Modifiers::COMMAND,
            Modifiers::SHIFT,
            Modifiers::ALT,
        ] {
            let mut jump = JumpToRow::default();
            let mut shared = new_shared(10);
            jump.open();
            jump.input = "4".to_owned();

            render(&mut jump, &mut shared, key_input(Key::Enter, modifiers));

            assert!(!jump.is_open(), "modifiers: {modifiers:?}");
            assert_eq!(shared.logs.single_selected_row(), Some(4));
            let focus = shared
                .logs
                .take_main_row_focus()
                .expect("valid row should request focus");
            assert_eq!(focus.row, 4);
            assert_eq!(focus.search_table_sync, SearchTableSync::Sync);
        }
    }

    #[test]
    fn valid_rows_replace_selection_and_request_focus() {
        for row in [0, 4, 9] {
            let mut jump = JumpToRow::default();
            let mut shared = new_shared(10);
            shared.logs.replace_selection_with(7);
            jump.open();
            jump.input = row.to_string();

            render(
                &mut jump,
                &mut shared,
                key_input(Key::Enter, Modifiers::NONE),
            );

            assert!(!jump.is_open());
            assert_eq!(shared.logs.single_selected_row(), Some(row));
            let focus = shared
                .logs
                .take_main_row_focus()
                .expect("valid row should request focus");
            assert_eq!(focus.row, row);
            assert_eq!(focus.search_table_sync, SearchTableSync::Sync);
        }
    }

    #[test]
    fn valid_selected_row_stays_selected() {
        let mut jump = JumpToRow::default();
        let mut shared = new_shared(10);
        shared.logs.replace_selection_with(4);
        jump.open();
        jump.input = "4".to_owned();

        render(
            &mut jump,
            &mut shared,
            key_input(Key::Enter, Modifiers::NONE),
        );

        assert!(!jump.is_open());
        assert_eq!(shared.logs.single_selected_row(), Some(4));
        assert_eq!(shared.logs.selected_count(), 1);
    }

    #[test]
    fn invalid_rows_preserve_session_state() {
        for (input, logs_count) in [
            ("", 10),
            ("text", 10),
            ("-1", 10),
            ("18446744073709551616", 10),
            (" 4", 10),
            ("10", 10),
            ("11", 10),
            ("0", 0),
        ] {
            let mut jump = JumpToRow::default();
            let mut shared = new_shared(logs_count);
            shared.logs.replace_selection_with(3);
            shared.logs.request_main_row_focus(6, SearchTableSync::Skip);
            jump.open();
            jump.input = input.to_owned();

            render(
                &mut jump,
                &mut shared,
                key_input(Key::Enter, Modifiers::NONE),
            );

            assert!(jump.is_open(), "input: {input:?}");
            assert!(jump.validation_message(logs_count).is_some());
            assert_eq!(shared.logs.single_selected_row(), Some(3));
            let focus = shared
                .logs
                .take_main_row_focus()
                .expect("existing focus should be preserved");
            assert_eq!(focus.row, 6);
            assert_eq!(focus.search_table_sync, SearchTableSync::Skip);
        }
    }

    #[test]
    fn opening_click_does_not_close_overlay() {
        let mut jump = JumpToRow::default();
        let mut shared = new_shared(10);
        let ctx = Context::default();

        let _ = ctx.run_ui(pointer_input(true), |_| {});
        jump.open();
        let _ = ctx.run_ui(pointer_input(false), |ui| jump.render(&mut shared, ui));
        assert!(jump.is_open());

        let _ = ctx.run_ui(pointer_input(true), |ui| jump.render(&mut shared, ui));
        let _ = ctx.run_ui(pointer_input(false), |ui| jump.render(&mut shared, ui));
        assert!(!jump.is_open());
    }

    #[test]
    fn escape_closes_without_changing_session_state() {
        let mut jump = JumpToRow::default();
        let mut shared = new_shared(10);
        shared.logs.replace_selection_with(3);
        shared.logs.request_main_row_focus(6, SearchTableSync::Skip);
        jump.open();
        jump.input = "8".to_owned();

        render(
            &mut jump,
            &mut shared,
            key_input(Key::Escape, Modifiers::NONE),
        );

        assert!(!jump.is_open());
        assert_eq!(shared.logs.single_selected_row(), Some(3));
        let focus = shared
            .logs
            .take_main_row_focus()
            .expect("existing focus should be preserved");
        assert_eq!(focus.row, 6);
        assert_eq!(focus.search_table_sync, SearchTableSync::Skip);
    }
}
