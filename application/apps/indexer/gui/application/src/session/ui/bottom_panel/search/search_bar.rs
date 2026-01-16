use tokio::sync::mpsc::Sender;

use egui::{
    Align, Button, Frame, Id, Key, Label, Layout, Margin, Modifiers, RichText, Stroke, TextEdit,
    Ui, Widget, vec2,
};
use processor::search::filter::SearchFilter;
use uuid::Uuid;

use crate::{
    common::phosphor::{self, icons},
    host::ui::UiActions,
    session::{command::SessionCommand, types::OperationPhase, ui::shared::SessionShared},
};

#[derive(Debug, Clone)]
pub struct SearchBar {
    cmd_tx: Sender<SessionCommand>,
    pub query: String,
    pub is_regex: bool,
    pub match_case: bool,
    pub is_word: bool,
    pub temp_filter: Option<SearchFilter>,
}

impl SearchBar {
    pub fn new(cmd_tx: Sender<SessionCommand>) -> Self {
        Self {
            cmd_tx,
            query: String::default(),
            is_regex: true,
            match_case: false,
            is_word: false,
            temp_filter: None,
        }
    }
    pub fn render_content(
        &mut self,
        shared: &mut SessionShared,
        actions: &mut UiActions,
        ui: &mut Ui,
    ) {
        // - Capture enter before creating text edit to prevent it from stealing it.
        // - Check if backspace is pressed for handling temp filter without consuming it.
        let (enter_pressed, backspace_pressed, command_modifier) = ui.input_mut(|i| {
            let backspace_pressed = i.key_pressed(Key::Backspace);
            let enter_pressed = i.consume_key(Modifiers::NONE, Key::Enter);
            (enter_pressed, backspace_pressed, i.modifiers.command)
        });

        // If user pressed backspace on empty input while it has temp filter applied:
        // - If Ctrl(Command) is pressed then we remove the temp filter.
        // - If no modifier is pressed then we remove the temp filter, pop the last char
        //   from it and use it as the current text for the text input.
        let move_cursor_end = if backspace_pressed
            && self.query.is_empty()
            && let Some(mut filter) = self.temp_filter.take()
        {
            self.drop_search(shared, actions);
            if command_modifier {
                false
            } else {
                filter.value.pop();
                self.query = filter.value;
                true
            }
        } else {
            false
        };

        // Apply temp filter on pressing enter.
        if enter_pressed && !self.query.is_empty() {
            if self.temp_filter.is_some() {
                self.drop_search(shared, actions);
            }

            let filter = SearchFilter::new(
                std::mem::take(&mut self.query),
                self.is_regex,
                !self.match_case,
                self.is_word,
            );

            let operation_id = Uuid::new_v4();
            let cmd = SessionCommand::ApplySearchFilter {
                operation_id,
                filters: vec![filter.clone()],
            };
            if actions.try_send_command(&self.cmd_tx, cmd) {
                shared.search.set_search_operation(operation_id);
                self.temp_filter = Some(filter);
            }
        }

        // Text id is needed to keep track if the text control is focused.
        let text_id = ui.id().with("search_text");

        ui.allocate_ui_with_layout(
            vec2(ui.available_width(), 25.),
            Layout::right_to_left(Align::Center),
            |ui| {
                self.render_filter_status(shared, ui);

                ui.toggle_value(&mut self.is_regex, "Regex")
                    .on_hover_text("Use Regex Expression");
                ui.toggle_value(&mut self.is_word, "Word")
                    .on_hover_text("Match Whole Word");
                ui.toggle_value(&mut self.match_case, "Case")
                    .on_hover_text("Match Case");

                ui.allocate_ui_with_layout(
                    ui.available_size(),
                    Layout::left_to_right(Align::Center),
                    |ui| {
                        // Create frame imitating TextEdit frame so we can add temp filter to
                        // it to appear for users as part of the TextEdit itself.
                        Frame::new()
                            .inner_margin(2)
                            .corner_radius(ui.visuals().widgets.inactive.corner_radius)
                            .fill(ui.visuals().extreme_bg_color)
                            .stroke(Self::text_frame_stroke(ui, text_id))
                            .show(ui, |ui| {
                                self.render_temp_filter(shared, actions, ui);

                                let mut text_output = TextEdit::singleline(&mut self.query)
                                    .id(text_id)
                                    .frame(false)
                                    .hint_text("Type a Search Request")
                                    .desired_width(ui.available_width())
                                    .show(ui);

                                if move_cursor_end {
                                    // Removing last char position will move the cursor to end.
                                    text_output.state.cursor.set_char_range(None);
                                    text_output.state.store(ui.ctx(), text_output.response.id);
                                }
                                ////TODO AAZ: Request focus on start session or tab switch only.
                                //input_res.request_focus();
                            })
                    },
                );
            },
        );
    }

    /// Renders temp filter if exists inside input frame.
    fn render_temp_filter(
        &mut self,
        shared: &mut SessionShared,
        actions: &mut UiActions,
        ui: &mut Ui,
    ) {
        if let Some(filter) = self.temp_filter.take() {
            ui.add_space(1.);

            Frame::new()
                .inner_margin(Margin::symmetric(2, 0))
                .corner_radius(2)
                .fill(ui.style().visuals.faint_bg_color)
                .stroke(ui.style().visuals.window_stroke)
                .show(ui, |ui| {
                    ui.horizontal(|ui| {
                        ui.label(&filter.value);

                        ui.style_mut().visuals.button_frame = false;
                        // Add to filters
                        let save_txt = RichText::new(icons::fill::FLOPPY_DISK_BACK)
                            .family(phosphor::fill_font_family());
                        if Button::new(save_txt)
                            .ui(ui)
                            .on_hover_text("Add to Filters")
                            .clicked()
                        {
                            // TODO: Add to filters
                        }

                        // Add to charts
                        if Button::new(icons::regular::CHART_LINE)
                            .ui(ui)
                            .on_hover_text("Add to Charts")
                            .clicked()
                        {
                            //TODO: Add to charts
                        }

                        // Remove filter button
                        if Button::new(icons::regular::X)
                            .ui(ui)
                            .on_hover_text("Remove filter")
                            .clicked()
                        {
                            self.drop_search(shared, actions);
                        } else {
                            self.temp_filter = Some(filter);
                        }
                    })
                });
        }
    }

    /// Generate stroke for text input frame depending on if it's
    /// focused or not.
    fn text_frame_stroke(ui: &mut Ui, text_id: Id) -> Stroke {
        let noninteractive = &ui.visuals().widgets.noninteractive;
        if ui.memory(|m| m.focused().is_some_and(|id| id == text_id)) {
            Stroke::new(
                noninteractive.bg_stroke.width,
                ui.visuals().text_cursor.stroke.color,
            )
        } else {
            noninteractive.bg_stroke
        }
    }

    fn render_filter_status(&mut self, shared: &SessionShared, ui: &mut Ui) {
        let logs_count = shared.logs.logs_count;
        if !shared.search.is_search_active() || logs_count == 0 {
            return;
        }

        ui.horizontal_centered(|ui| {
            let percentage = shared.search.total_count() as f32 / logs_count as f32 * 100.;

            let state_txt = format!(
                "{}/{} ({percentage:.2}%)",
                shared.search.total_count(),
                logs_count,
            );
            Label::new(state_txt).selectable(false).ui(ui);

            if shared
                .search
                .search_operation_phase()
                .is_some_and(|ph| ph == OperationPhase::Initializing)
            {
                ui.spinner();
            }
        });

        ui.separator();
    }

    fn drop_search(&self, shared: &mut SessionShared, actions: &mut UiActions) {
        let operation_id = shared.search.processing_search_operation();
        actions.try_send_command(&self.cmd_tx, SessionCommand::DropSearch { operation_id });
        shared.drop_search();
    }
}
