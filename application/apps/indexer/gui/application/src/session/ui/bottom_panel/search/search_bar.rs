use egui::{
    Align, Button, Frame, Id, Key, Label, Layout, Margin, Modifiers, Stroke, TextEdit, Ui, Widget,
    vec2,
};
use processor::search::filter::SearchFilter;

use crate::{
    host::ui::UiActions,
    session::{command::SessionCommand, communication::UiSenders, data::SessionState},
};

#[derive(Debug, Clone)]
pub struct SearchBar {
    pub query: String,
    pub is_regex: bool,
    pub match_case: bool,
    pub is_word: bool,
    pub temp_filter: Option<SearchFilter>,
    search_event: Option<SearchEvent>,
}

impl Default for SearchBar {
    fn default() -> Self {
        Self {
            query: String::default(),
            is_regex: true,
            match_case: false,
            is_word: false,
            temp_filter: None,
            search_event: None,
        }
    }
}

#[derive(Debug, Clone)]
pub enum SearchEvent {
    SearchDropped,
}

impl SearchBar {
    #[must_use]
    pub fn render_content(
        &mut self,
        data: &SessionState,
        senders: &UiSenders,
        actions: &mut UiActions,
        ui: &mut Ui,
    ) -> Option<SearchEvent> {
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
            actions.try_send_command(&senders.cmd_tx, SessionCommand::DropSearch);
            self.search_event = Some(SearchEvent::SearchDropped);
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
                actions.try_send_command(&senders.cmd_tx, SessionCommand::DropSearch);
                self.search_event = Some(SearchEvent::SearchDropped);
            }

            let filter = SearchFilter::new(
                std::mem::take(&mut self.query),
                self.is_regex,
                !self.match_case,
                self.is_word,
            );

            let cmd = SessionCommand::ApplySearchFilter(vec![filter.clone()]);
            if actions.try_send_command(&senders.cmd_tx, cmd) {
                self.temp_filter = Some(filter);
            }
        }

        // Text id is needed to keep track if the text control is focused.
        let text_id = ui.id().with("search_text");

        ui.allocate_ui_with_layout(
            vec2(ui.available_width(), 25.),
            Layout::right_to_left(Align::Center),
            |ui| {
                self.render_filter_status(data, ui);

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
                                self.render_temp_filter(senders, actions, ui);

                                let mut text_output = TextEdit::singleline(&mut self.query)
                                    .id(text_id)
                                    .frame(false)
                                    .hint_text("Type a Search Request")
                                    .desired_width(ui.available_width())
                                    .show(ui);

                                if move_cursor_end {
                                    // Removing last char position will move to end be default.
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

        self.search_event.take()
    }

    /// Renders temp filter if exists inside input frame.
    fn render_temp_filter(&mut self, senders: &UiSenders, actions: &mut UiActions, ui: &mut Ui) {
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
                        if Button::new("💾")
                            .ui(ui)
                            .on_hover_text("Add to Filters")
                            .clicked()
                        {
                            // TODO: Add to filters
                        }

                        // Add to charts
                        if Button::new("📈")
                            .ui(ui)
                            .on_hover_text("Add to Charts")
                            .clicked()
                        {
                            //TODO: Add to charts
                        }

                        // Remove filter button
                        if Button::new("❌")
                            .ui(ui)
                            .on_hover_text("Remove filter")
                            .clicked()
                        {
                            actions.try_send_command(&senders.cmd_tx, SessionCommand::DropSearch);
                            self.search_event = Some(SearchEvent::SearchDropped);
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

    fn render_filter_status(&mut self, data: &SessionState, ui: &mut Ui) {
        if !data.search.is_search_active() || data.logs_count == 0 {
            return;
        }

        ui.horizontal_centered(|ui| {
            let percentage = data.search.search_count as f32 / data.logs_count as f32 * 100.;

            let state_txt = format!(
                "{}/{} ({percentage:.2}%)",
                data.search.search_count, data.logs_count,
            );
            Label::new(state_txt).selectable(false).ui(ui);

            if data.search.current_matches_map().is_none() {
                ui.spinner();
            }
        });

        ui.separator();
    }
}
