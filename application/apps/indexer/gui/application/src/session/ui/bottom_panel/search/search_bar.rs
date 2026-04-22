use tokio::sync::mpsc::Sender;

use egui::{
    Align, Button, Frame, Id, Key, Layout, Margin, Modifiers, RichText, Stroke, TextEdit, Ui,
    Widget, vec2,
};
use processor::search::filter::SearchFilter;

use crate::{
    common::{
        phosphor::{self, icons},
        ui::visibility_tracker::VisibilityTracker,
        validation::{ValidationEligibility, validate_filter},
    },
    host::{
        notification::AppNotification,
        ui::{UiActions, registry::filters::FilterRegistry},
    },
    session::{
        command::SessionCommand,
        types::OperationPhase,
        ui::shared::{SearchSyncTarget, SessionShared},
    },
};

#[derive(Debug, Clone)]
pub struct SearchBar {
    cmd_tx: Sender<SessionCommand>,
    pub query: String,
    pub is_regex: bool,
    pub match_case: bool,
    pub is_word: bool,
    // Used to focus the search input when the search bar becomes visible again.
    visibility_tracker: VisibilityTracker,
}

impl SearchBar {
    pub fn new(cmd_tx: Sender<SessionCommand>) -> Self {
        Self {
            cmd_tx,
            query: String::default(),
            is_regex: true,
            match_case: false,
            is_word: false,
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
            && let Some(mut filter) = shared.filters.take_temp_search()
        {
            if command_modifier {
                self.drop_search(shared, actions, registry);
                false
            } else {
                self.drop_search(shared, actions, registry);
                filter.value.pop();
                self.query = filter.value;
                true
            }
        } else {
            false
        };

        // Apply temp filter on pressing enter.
        if enter_pressed {
            if !self.query.is_empty() {
                self.apply_temp_search(shared, actions, registry);
            } else if shared.filters.active_temp_search.is_some()
                && shared.pin_temp_search(registry)
            {
                shared
                    .sync_search_pipelines(registry, SearchSyncTarget::Filter)
                    .into_iter()
                    .for_each(|cmd| _ = actions.try_send_command(&self.cmd_tx, cmd));
            }
        }

        // Text id is needed to keep track if the text control is focused.
        let text_id = ui.id().with("search_text");
        let became_visible = self.visibility_tracker.is_newly_visible(ui);

        ui.allocate_ui_with_layout(
            vec2(ui.available_width(), 25.),
            Layout::right_to_left(Align::Center),
            |ui| {
                self.render_filter_status(shared, ui);

                ui.toggle_value(
                    &mut self.is_regex,
                    RichText::new(icons::regular::ASTERISK).size(14.0),
                )
                .on_hover_text("Use Regular Expression");
                ui.toggle_value(
                    &mut self.is_word,
                    RichText::new(icons::regular::TEXT_T).size(14.0),
                )
                .on_hover_text("Match Whole Word");

                ui.toggle_value(
                    &mut self.match_case,
                    RichText::new(icons::regular::TEXT_AA).size(14.0),
                )
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
                                self.render_active_search(shared, actions, registry, ui);

                                let mut text_output = TextEdit::singleline(&mut self.query)
                                    .id(text_id)
                                    .frame(Frame::NONE)
                                    .hint_text("Type a Search Request")
                                    .desired_width(ui.available_width())
                                    .show(ui);

                                if move_cursor_end {
                                    // Removing last char position will move the cursor to end.
                                    text_output.state.cursor.set_char_range(None);
                                    text_output.state.store(ui.ctx(), text_output.response.id);
                                }

                                if became_visible {
                                    text_output.response.request_focus();
                                }
                            })
                    },
                );
            },
        );
    }

    fn apply_temp_search(
        &mut self,
        shared: &mut SessionShared,
        actions: &mut UiActions,
        registry: &FilterRegistry,
    ) {
        let filter = SearchFilter::plain(self.query.clone())
            .regex(self.is_regex)
            .ignore_case(!self.match_case)
            .word(self.is_word);

        match validate_filter(&filter) {
            ValidationEligibility::Eligible => {
                self.query.clear();
                shared.filters.set_temp_search(filter);
                shared
                    .sync_search_pipelines(registry, SearchSyncTarget::Filter)
                    .into_iter()
                    .for_each(|cmd| _ = actions.try_send_command(&self.cmd_tx, cmd));
            }
            ValidationEligibility::Ineligible { reason } => {
                let msg = format!("Filter couldn't be applied: {reason}");
                actions.add_notification(AppNotification::Warning(msg));
            }
        }
    }

    /// Renders active search if exists inside input frame.
    fn render_active_search(
        &mut self,
        shared: &mut SessionShared,
        actions: &mut UiActions,
        registry: &mut FilterRegistry,
        ui: &mut Ui,
    ) {
        if let Some(filter_txt) = shared
            .filters
            .active_temp_search
            .as_ref()
            .map(|temp| temp.filter().value.to_owned())
        {
            ui.add_space(1.);

            Frame::new()
                .inner_margin(Margin::symmetric(2, 0))
                .corner_radius(2)
                .fill(ui.style().visuals.faint_bg_color)
                .stroke(ui.style().visuals.window_stroke)
                .show(ui, |ui| {
                    ui.horizontal(|ui| {
                        ui.label(filter_txt);

                        ui.style_mut().visuals.button_frame = false;

                        // Add to filters
                        {
                            let save_txt = RichText::new(icons::fill::FLOPPY_DISK_BACK)
                                .family(phosphor::fill_font_family());

                            let disabled_reason =
                                shared.filters.active_temp_search.as_ref().and_then(|temp| {
                                    match temp.filter_eligibility() {
                                        ValidationEligibility::Eligible => None,
                                        ValidationEligibility::Ineligible { reason } => {
                                            Some(reason.as_str())
                                        }
                                    }
                                });

                            let mut add_btn = ui
                                .add_enabled(disabled_reason.is_none(), Button::new(save_txt))
                                .on_hover_text("Add to Filters");

                            if let Some(reason) = disabled_reason {
                                add_btn = add_btn.on_disabled_hover_ui(|ui| {
                                    ui.set_max_width(ui.spacing().tooltip_width);

                                    let text = format!("Filter: {reason}");
                                    ui.label(text);
                                });
                            }

                            if add_btn.clicked() && shared.pin_temp_search(registry) {
                                // Re-apply search which now includes new filter and NO active_search
                                shared
                                    .sync_search_pipelines(registry, SearchSyncTarget::Filter)
                                    .into_iter()
                                    .for_each(|cmd| {
                                        _ = actions.try_send_command(&self.cmd_tx, cmd)
                                    });
                            }
                        }

                        // Add to search values.
                        {
                            let disabled_reason =
                                shared.filters.active_temp_search.as_ref().and_then(|temp| {
                                    match temp.search_value_eligibility() {
                                        ValidationEligibility::Eligible => None,
                                        ValidationEligibility::Ineligible { reason } => {
                                            Some(reason.as_str())
                                        }
                                    }
                                });

                            let mut add_btn = ui
                                .add_enabled(
                                    disabled_reason.is_none(),
                                    Button::new(icons::regular::CHART_LINE),
                                )
                                .on_hover_text("Add to Search Values");

                            if let Some(reason) = disabled_reason {
                                add_btn = add_btn.on_disabled_hover_ui(|ui| {
                                    ui.set_max_width(ui.spacing().tooltip_width);

                                    let text = format!("Search Value: {reason}");
                                    ui.label(text);
                                })
                            }

                            if add_btn.clicked() {
                                let success = shared.pin_temp_search_as_value(registry);
                                if success {
                                    // We need to consider both targets (filters and search values)
                                    // because we are removed the current temp filter here.
                                    shared
                                        .sync_search_pipelines(registry, SearchSyncTarget::Both)
                                        .into_iter()
                                        .for_each(|cmd| {
                                            _ = actions.try_send_command(&self.cmd_tx, cmd)
                                        });
                                }
                            }
                        }

                        if Button::new(icons::regular::X)
                            .ui(ui)
                            .on_hover_text("Remove filter")
                            .clicked()
                        {
                            self.drop_search(shared, actions, registry);
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
            let percentage = shared.search.search_result_count() as f32 / logs_count as f32 * 100.;

            let state_txt = format!(
                "{}/{} ({percentage:.2}%)",
                shared.search.search_result_count(),
                logs_count,
            );
            ui.label(state_txt);

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

    /// Discards the current temporary search and synchronizes the session state
    /// considering the already applied filters.
    fn drop_search(
        &self,
        shared: &mut SessionShared,
        actions: &mut UiActions,
        registry: &FilterRegistry,
    ) {
        shared.filters.clear_temp_search();
        shared
            .sync_search_pipelines(registry, SearchSyncTarget::Filter)
            .into_iter()
            .for_each(|cmd| _ = actions.try_send_command(&self.cmd_tx, cmd));
    }
}

#[cfg(test)]
mod tests {
    use std::path::PathBuf;

    use stypes::{FileFormat, ObserveOrigin};
    use tokio::{runtime::Runtime, sync::mpsc};
    use uuid::Uuid;

    use crate::{
        host::{common::parsers::ParserNames, notification::AppNotification, ui::UiActions},
        session::{types::ObserveOperation, ui::shared::SessionInfo},
    };

    use super::*;

    fn new_shared() -> SessionShared {
        let session_info = SessionInfo {
            id: Uuid::new_v4(),
            title: "test".to_owned(),
            parser: ParserNames::Text,
        };
        let observe_op = ObserveOperation::new(
            Uuid::new_v4(),
            ObserveOrigin::File(
                "source".to_owned(),
                FileFormat::Text,
                PathBuf::from("source.log"),
            ),
        );

        SessionShared::new(session_info, observe_op)
    }

    #[test]
    fn invalid_temp_regex_warns() {
        let runtime = Runtime::new().expect("runtime should initialize");
        let mut shared = new_shared();
        let mut actions = UiActions::new(runtime.handle().clone());
        let registry = FilterRegistry::default();
        let (cmd_tx, mut cmd_rx) = mpsc::channel(4);
        let mut search_bar = SearchBar::new(cmd_tx);

        shared
            .filters
            .set_temp_search(SearchFilter::plain("status=ok").ignore_case(true));
        search_bar.query = "(".to_owned();
        search_bar.is_regex = true;

        search_bar.apply_temp_search(&mut shared, &mut actions, &registry);

        assert_eq!(search_bar.query, "(");
        assert_eq!(
            shared
                .filters
                .active_temp_search
                .as_ref()
                .map(|temp| temp.filter().value.as_str()),
            Some("status=ok")
        );
        assert!(cmd_rx.try_recv().is_err());

        let notifications: Vec<_> = actions.drain_notifications().collect();
        assert_eq!(notifications.len(), 1);
        assert!(matches!(
            &notifications[0],
            AppNotification::Warning(msg)
                if msg.starts_with("Filter couldn't be applied: Invalid regex:")
        ));
    }
}
