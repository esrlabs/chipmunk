//! Floating Find in Search Results UI.

use egui::{
    Align2, Area, Frame, Id, Key, Margin, Modifiers, Order, Rect, RichText, TextEdit, Ui, Widget,
    vec2,
};
use processor::search::filter::SearchFilter;
use session_core::state::IndexedNavigation;
use tokio::sync::mpsc::Sender;
use uuid::Uuid;

use crate::{
    common::{phosphor::icons, ui::buttons, validation::ValidationEligibility},
    host::{notification::AppNotification, ui::UiActions},
    session::{command::SessionCommand, ui::shared::searching::NestedSearchState},
};

/// Local editing and focus state for the floating nested-search widget.
#[derive(Debug)]
pub struct NestedSearch {
    cmd_tx: Sender<SessionCommand>,
    query: String,
    is_regex: bool,
    match_case: bool,
    is_word: bool,
    focus_requested: bool,
}

#[derive(Debug, Clone, Copy)]
enum NestedSearchButton {
    Previous,
    Next,
    Close,
}

impl NestedSearch {
    /// Creates a nested-search editor using the session command channel.
    pub fn new(cmd_tx: Sender<SessionCommand>) -> Self {
        Self {
            cmd_tx,
            query: String::new(),
            is_regex: true,
            match_case: false,
            is_word: false,
            focus_requested: false,
        }
    }

    /// Requests input focus on the next rendered frame.
    pub fn request_focus(&mut self) {
        self.focus_requested = true;
    }

    /// Restores the draft and controls to their initial state.
    pub fn reset(&mut self) {
        let Self {
            cmd_tx: _,
            query,
            is_regex,
            match_case,
            is_word,
            focus_requested,
        } = self;

        query.clear();
        *is_regex = true;
        *match_case = false;
        *is_word = false;
        *focus_requested = false;
    }

    /// Renders over the top-right of the search-results table.
    pub fn render(
        &mut self,
        session_id: Uuid,
        table_rect: Rect,
        state: &mut NestedSearchState,
        actions: &mut UiActions,
        ui: &Ui,
    ) {
        const MARGIN: f32 = 6.0;

        let position = table_rect.right_top() + vec2(-MARGIN, MARGIN);
        Area::new(Id::new(("nested_search", session_id)))
            .order(Order::Foreground)
            .pivot(Align2::RIGHT_TOP)
            .fixed_pos(position)
            .show(ui.ctx(), |ui| {
                Frame::window(ui.style())
                    .inner_margin(Margin::symmetric(8, 4))
                    .show(ui, |ui| self.render_row(session_id, state, actions, ui));
            });
    }

    fn render_row(
        &mut self,
        session_id: Uuid,
        state: &mut NestedSearchState,
        actions: &mut UiActions,
        ui: &mut Ui,
    ) {
        let pending = state.is_pending();
        let text_id = Id::new(("nested_search_input", session_id));
        let text_focused = ui.memory(|memory| memory.focused() == Some(text_id));
        let enter_pressed = ui.input_mut(|input| {
            !pending && text_focused && input.consume_key(Modifiers::NONE, Key::Enter)
        });

        let mut clicked_button = None;
        ui.horizontal(|ui| {
            let has_active_filter = state.has_active_filter();
            ui.add_enabled_ui(!pending, |ui| {
                let response = TextEdit::singleline(&mut self.query)
                    .id(text_id)
                    .hint_text("Find in Search Results")
                    .desired_width(220.0)
                    .show(ui)
                    .response;
                if self.focus_requested {
                    response.request_focus();
                    self.focus_requested = false;
                }

                ui.toggle_value(
                    &mut self.match_case,
                    RichText::new(icons::regular::TEXT_AA).size(14.0),
                )
                .on_hover_text("Match Case");
                ui.toggle_value(
                    &mut self.is_word,
                    RichText::new(icons::regular::TEXT_T).size(14.0),
                )
                .on_hover_text("Match Whole Word");
                ui.toggle_value(
                    &mut self.is_regex,
                    RichText::new(icons::regular::ASTERISK).size(14.0),
                )
                .on_hover_text("Use Regular Expression");

                if ui
                    .add_enabled(
                        has_active_filter,
                        buttons::bottom_panel_icon(
                            RichText::new(icons::regular::ARROW_UP).size(14.0),
                        ),
                    )
                    .on_hover_text("Previous match")
                    .on_disabled_hover_text("Previous match")
                    .clicked()
                {
                    clicked_button = Some(NestedSearchButton::Previous);
                }
                if ui
                    .add_enabled(
                        has_active_filter,
                        buttons::bottom_panel_icon(
                            RichText::new(icons::regular::ARROW_DOWN).size(14.0),
                        ),
                    )
                    .on_hover_text("Next match")
                    .on_disabled_hover_text("Next match")
                    .clicked()
                {
                    clicked_button = Some(NestedSearchButton::Next);
                }
            });

            if pending {
                ui.spinner();
            }

            if buttons::bottom_panel_icon(RichText::new(icons::regular::X).size(14.0))
                .ui(ui)
                .on_hover_text("Close")
                .clicked()
            {
                clicked_button = Some(NestedSearchButton::Close);
            }
        });

        if enter_pressed {
            self.submit(state, actions);
            return;
        }

        match clicked_button {
            Some(NestedSearchButton::Close) => self.close(state),
            Some(NestedSearchButton::Previous) => {
                state.request_match(IndexedNavigation::Previous, &self.cmd_tx, actions);
            }
            Some(NestedSearchButton::Next) => {
                state.request_match(IndexedNavigation::Next, &self.cmd_tx, actions);
            }
            None => {}
        }
    }

    fn submit(&self, state: &mut NestedSearchState, actions: &mut UiActions) {
        if self.query.is_empty() {
            state.clear_filter();
            return;
        }

        let filter = SearchFilter::plain(self.query.clone())
            .regex(self.is_regex)
            .ignore_case(!self.match_case)
            .word(self.is_word);
        if let ValidationEligibility::Ineligible { reason } = state.apply_filter(filter) {
            let message = format!("Nested filter couldn't be applied: {reason}");
            let notification = AppNotification::Warning(message);
            actions.add_notification(notification);
            return;
        }

        state.request_match(IndexedNavigation::Next, &self.cmd_tx, actions);
    }

    fn close(&mut self, state: &mut NestedSearchState) {
        state.close();
        self.reset();
    }
}

#[cfg(test)]
mod tests {
    use processor::search::filter::SearchFilter;
    use tokio::{runtime::Runtime, sync::mpsc};

    use super::NestedSearch;
    use crate::{
        host::{notification::AppNotification, ui::UiActions},
        session::ui::shared::searching::NestedSearchState,
    };

    #[test]
    fn invalid_submission_warns_without_replacing_filter() {
        let runtime = Runtime::new().expect("runtime should initialize");
        let mut actions = UiActions::new(runtime.handle().clone());
        let mut state = NestedSearchState::default();
        let (cmd_tx, mut cmd_rx) = mpsc::channel(1);
        let mut widget = NestedSearch::new(cmd_tx);
        widget.query = "(".to_owned();
        let active_filter = SearchFilter::plain("status=ok");
        assert!(state.apply_filter(active_filter).is_eligible());
        let expected_state = state.clone();

        widget.submit(&mut state, &mut actions);

        assert_eq!(state, expected_state);
        assert!(cmd_rx.try_recv().is_err());
        let notifications: Vec<_> = actions.drain_notifications().collect();
        assert_eq!(notifications.len(), 1);
        assert!(matches!(notifications[0], AppNotification::Warning(_)));
    }
}
