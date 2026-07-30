//! Floating Find in Search Results UI.

use std::time::Instant;

use egui::{
    Align2, Area, Button, Context, Frame, Id, Key, Margin, Modifiers, Order, Rect, RichText,
    Stroke, TextEdit, Ui, Widget, pos2, vec2,
};
use tokio::sync::mpsc::Sender;
use uuid::Uuid;

use processor::search::filter::SearchFilter;
use session_core::state::IndexedNavigation;

use crate::{
    common::{phosphor::icons, validation::ValidationEligibility},
    host::{common::colors::main_accent_stroke, notification::AppNotification, ui::UiActions},
    session::{command::SessionCommand, ui::shared::searching::NestedSearchState},
};

const ICON_SIZE: f32 = 14.0;

/// Local editing and focus state for the floating nested-search widget.
#[derive(Debug)]
pub struct NestedSearch {
    cmd_tx: Sender<SessionCommand>,
    query: String,
    is_regex: bool,
    match_case: bool,
    is_word: bool,
    /// Requests focus when the enabled editor next renders.
    pub focus_requested: bool,
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

    /// Returns whether this session's nested-search input owns keyboard focus.
    pub fn has_focus(&self, session_id: Uuid, ctx: &Context) -> bool {
        let input_id = Self::input_id(session_id);
        ctx.memory(|memory| memory.focused() == Some(input_id))
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
            .order(Order::Middle)
            .pivot(Align2::RIGHT_TOP)
            .fixed_pos(position)
            .show(ui.ctx(), |ui| {
                let output = Frame::window(ui.style())
                    .inner_margin(Margin::same(4))
                    .show(ui, |ui| self.render_row(session_id, state, actions, ui));

                if let Some(remaining) = state.progress_remaining(Instant::now()) {
                    if remaining.is_zero() {
                        paint_pending_border(ui, output.response.rect);
                    } else {
                        ui.ctx().request_repaint_after(remaining);
                    }
                }
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
        let text_id = Self::input_id(session_id);
        let text_focused = ui.memory(|memory| memory.focused() == Some(text_id));
        let enter_pressed = ui.input_mut(|input| {
            !pending && text_focused && input.consume_key(Modifiers::NONE, Key::Enter)
        });
        let escape_key_pressed = ui.input(|input| input.key_pressed(Key::Escape));

        let mut clicked_button = None;
        let mut escape_pressed = false;
        ui.horizontal(|ui| {
            ui.spacing_mut().item_spacing.x = 1.0;

            let has_active_filter = state.has_active_filter();
            ui.add_enabled_ui(!pending, |ui| {
                let response = TextEdit::singleline(&mut self.query)
                    .id(text_id)
                    .hint_text("Find in Search Results")
                    .desired_width(150.0)
                    .show(ui)
                    .response;
                if self.focus_requested && !pending {
                    response.request_focus();
                    self.focus_requested = false;
                }
                // egui may release text focus while processing Escape in this frame.
                let editor_owned_escape = escape_key_pressed
                    && (response.has_focus() || response.lost_focus())
                    && ui.memory(|memory| memory.top_modal_layer().is_none());
                if editor_owned_escape {
                    ui.input_mut(|input| {
                        input.consume_key(Modifiers::NONE, Key::Escape);
                    });
                    escape_pressed = true;
                }

                const GROUP_SPACING: f32 = 2.0;
                ui.add_space(GROUP_SPACING);

                ui.toggle_value(
                    &mut self.match_case,
                    RichText::new(icons::regular::TEXT_AA).size(ICON_SIZE),
                )
                .on_hover_text("Match Case");
                ui.toggle_value(
                    &mut self.is_word,
                    RichText::new(icons::regular::TEXT_T).size(ICON_SIZE),
                )
                .on_hover_text("Match Whole Word");
                ui.toggle_value(
                    &mut self.is_regex,
                    RichText::new(icons::regular::ASTERISK).size(ICON_SIZE),
                )
                .on_hover_text("Use Regular Expression");

                ui.add_space(GROUP_SPACING);

                let previous_button = icon_button(icons::regular::ARROW_UP);
                if ui
                    .add_enabled(has_active_filter, previous_button)
                    .on_hover_text("Previous match")
                    .on_disabled_hover_text("Previous match")
                    .clicked()
                {
                    clicked_button = Some(NestedSearchButton::Previous);
                }
                let next_button = icon_button(icons::regular::ARROW_DOWN);
                if ui
                    .add_enabled(has_active_filter, next_button)
                    .on_hover_text("Next match")
                    .on_disabled_hover_text("Next match")
                    .clicked()
                {
                    clicked_button = Some(NestedSearchButton::Next);
                }
            });

            if icon_button(icons::regular::X)
                .ui(ui)
                .on_hover_text("Close")
                .clicked()
            {
                clicked_button = Some(NestedSearchButton::Close);
            }
        });

        if escape_pressed {
            self.close(state);
            return;
        }

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

    fn input_id(session_id: Uuid) -> Id {
        Id::new(("nested_search_input", session_id))
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

fn icon_button(icon: &'static str) -> Button<'static> {
    Button::new(RichText::new(icon).size(ICON_SIZE)).frame_when_inactive(false)
}

/// Paints an animated pending indicator along the bottom of `rect` and requests another frame.
fn paint_pending_border(ui: &Ui, rect: Rect) {
    const SEGMENT_FRACTION: f32 = 0.30;
    const SPEED: f64 = 0.45;

    let corner_radius = ui.visuals().window_corner_radius;
    let track_rect = Rect::from_min_max(
        pos2(rect.left() + f32::from(corner_radius.sw) / 2.0, rect.top()),
        pos2(
            rect.right() - f32::from(corner_radius.se) / 2.0,
            rect.bottom(),
        ),
    );
    let progress = ((ui.input(|input| input.time) * SPEED) % 1.0) as f32;
    let track_width = track_rect.width();
    let segment_width = track_width * SEGMENT_FRACTION;
    let start_x = track_rect.left() + track_width * progress;
    let y = track_rect.bottom() - 1.0;

    let stroke = Stroke {
        width: 2.0,
        color: main_accent_stroke(ui.visuals().dark_mode),
    };
    let painter = ui.painter().with_clip_rect(track_rect);
    for offset in [0.0, -track_width] {
        let segment_start = start_x + offset;
        painter.line_segment(
            [
                pos2(segment_start, y),
                pos2(segment_start + segment_width, y),
            ],
            stroke,
        );
    }
    ui.ctx().request_repaint();
}

#[cfg(test)]
mod tests {
    use egui::{Context, Event, Id, Key, Modifiers, RawInput, Rect, TextEdit, pos2, vec2};
    use processor::search::filter::SearchFilter;
    use regex::Regex;
    use session_core::state::IndexedNavigation;
    use tokio::{runtime::Runtime, sync::mpsc};
    use uuid::Uuid;

    use super::NestedSearch;
    use crate::{
        host::{notification::AppNotification, ui::UiActions},
        session::{command::SessionCommand, ui::shared::searching::NestedSearchState},
    };

    fn escape_input() -> RawInput {
        RawInput {
            events: vec![Event::Key {
                key: Key::Escape,
                physical_key: Some(Key::Escape),
                pressed: true,
                repeat: false,
                modifiers: Modifiers::NONE,
            }],
            ..Default::default()
        }
    }

    #[test]
    fn escape_closes_focused_editor() {
        let runtime = Runtime::new().expect("runtime should initialize");
        let mut actions = UiActions::new(runtime.handle().clone());
        let mut state = NestedSearchState::default();
        state.open();
        let (cmd_tx, _cmd_rx) = mpsc::channel(1);
        let mut widget = NestedSearch::new(cmd_tx);
        widget.focus_requested = true;

        let session_id = Uuid::new_v4();
        let table_rect = Rect::from_min_size(pos2(0.0, 0.0), vec2(600.0, 300.0));
        let ctx = Context::default();
        let _ = ctx.run_ui(RawInput::default(), |ui| {
            widget.render(session_id, table_rect, &mut state, &mut actions, ui);
        });
        let _ = ctx.run_ui(RawInput::default(), |ui| {
            widget.render(session_id, table_rect, &mut state, &mut actions, ui);
        });
        assert!(widget.has_focus(session_id, &ctx));

        let _ = ctx.run_ui(escape_input(), |ui| {
            widget.render(session_id, table_rect, &mut state, &mut actions, ui);
        });
        assert!(!state.is_open());
    }

    #[test]
    fn escape_ignores_other_editor() {
        let runtime = Runtime::new().expect("runtime should initialize");
        let mut actions = UiActions::new(runtime.handle().clone());
        let mut state = NestedSearchState::default();
        state.open();
        let (cmd_tx, _cmd_rx) = mpsc::channel(1);
        let mut widget = NestedSearch::new(cmd_tx);

        let session_id = Uuid::new_v4();
        let table_rect = Rect::from_min_size(pos2(0.0, 0.0), vec2(600.0, 300.0));
        let ctx = Context::default();
        let mut other_query = String::new();
        let _ = ctx.run_ui(RawInput::default(), |ui| {
            let response = TextEdit::singleline(&mut other_query)
                .id(Id::new("other_search_input"))
                .show(ui)
                .response;
            response.request_focus();
            widget.render(session_id, table_rect, &mut state, &mut actions, ui);
        });
        assert!(!widget.has_focus(session_id, &ctx));

        let _ = ctx.run_ui(escape_input(), |ui| {
            widget.render(session_id, table_rect, &mut state, &mut actions, ui);
        });
        assert!(state.is_open());
    }

    #[test]
    fn pending_editor_applies_deferred_focus_after_response() {
        let runtime = Runtime::new().expect("runtime should initialize");
        let mut actions = UiActions::new(runtime.handle().clone());
        let mut state = NestedSearchState::default();
        assert!(
            state
                .apply_filter(SearchFilter::plain("status=ok"))
                .is_eligible()
        );
        let (cmd_tx, mut cmd_rx) = mpsc::channel(1);
        let mut widget = NestedSearch::new(cmd_tx.clone());
        assert!(state.request_match(IndexedNavigation::Next, &cmd_tx, &mut actions));
        let request_id = match cmd_rx.try_recv().expect("request should be sent") {
            SessionCommand::FindNestedMatch(params) => params.request_id,
            command => panic!("expected nested request, got {command:?}"),
        };
        widget.focus_requested = true;

        let session_id = Uuid::new_v4();
        let table_rect = Rect::from_min_size(pos2(0.0, 0.0), vec2(600.0, 300.0));
        let ctx = Context::default();
        let _ = ctx.run_ui(RawInput::default(), |ui| {
            widget.render(session_id, table_rect, &mut state, &mut actions, ui);
        });
        assert!(!widget.has_focus(session_id, &ctx));

        assert!(state.accept_response(request_id));
        let _ = ctx.run_ui(RawInput::default(), |ui| {
            widget.render(session_id, table_rect, &mut state, &mut actions, ui);
        });
        assert!(widget.has_focus(session_id, &ctx));
    }

    #[test]
    fn invalid_submission_warns_without_replacing_filter() {
        let runtime = Runtime::new().expect("runtime should initialize");
        let mut actions = UiActions::new(runtime.handle().clone());
        let mut state = NestedSearchState::default();
        let (cmd_tx, mut cmd_rx) = mpsc::channel(1);
        let mut widget = NestedSearch::new(cmd_tx);
        widget.query = "(".to_owned();
        let active_filter = SearchFilter::plain("status=ok");
        assert!(state.apply_filter(active_filter.clone()).is_eligible());
        state.set_matcher(Box::new(Regex::new("status=ok").unwrap()));

        widget.submit(&mut state, &mut actions);

        assert_eq!(state.active_filter(), Some(&active_filter));
        assert!(
            state
                .matcher()
                .is_some_and(|matcher| matcher.is_match("status=ok"))
        );
        assert!(cmd_rx.try_recv().is_err());
        let notifications: Vec<_> = actions.drain_notifications().collect();
        assert_eq!(notifications.len(), 1);
        assert!(matches!(notifications[0], AppNotification::Warning(_)));
    }
}
