//! Host-level Quick Open overlay for recent sessions and favorite files.

use std::{path::PathBuf, sync::Arc, time::Duration};

use egui::{Align, Align2, Context, Key, Modifiers, ScrollArea, Ui, Window, vec2};
use tokio::sync::mpsc::Sender;

use crate::{
    common::{
        action_throttle::ActionThrottle, matcher::substring_matcher::SubstringMatcher,
        ui::search_picker::SearchPickerText,
    },
    host::{
        command::{HostCommand, OpenRecentSessionParam},
        common::ui_utls::{clicked_outside_rect, sized_singleline_text_edit},
        ui::storage::{HostStorage, recent::session::RecentSessionReopenMode},
    },
};

use super::UiActions;

mod row;
mod search;

const RESULT_LIMIT: usize = 100;

/// Searchable launcher for recent sessions and favorite-folder files.
#[derive(Debug)]
pub struct QuickOpen {
    cmd_tx: Sender<HostCommand>,
    open: bool,
    query: String,
    matcher: SubstringMatcher,
    results: Vec<QuickOpenItem>,
    /// Cached results need to be rebuilt from current storage.
    needs_recompute: bool,
    throttle: ActionThrottle,
    selected_index: usize,
    /// True until the search field receives focus after opening.
    first_open_frame: bool,
    scroll_selected_into_view: bool,
}

/// Cached result item containing only display text and the data needed to open it.
#[derive(Debug)]
enum QuickOpenItem {
    /// Recent-session match. The snapshot is looked up by key only when opened.
    RecentSession {
        source_key: Arc<str>,
        title: SearchPickerText,
        summary: SearchPickerText,
    },
    /// Favorite-file match from the current favorite-folder tree.
    FavoriteFile {
        path: PathBuf,
        name: SearchPickerText,
        path_text: SearchPickerText,
    },
}

#[derive(Debug, Clone, Copy)]
enum SelectionDirection {
    Previous,
    Next,
}

impl QuickOpen {
    /// Creates a closed Quick Open overlay that sends selected items to the host service.
    pub fn new(cmd_tx: Sender<HostCommand>) -> Self {
        Self {
            cmd_tx,
            open: false,
            query: String::new(),
            matcher: SubstringMatcher::default(),
            results: Vec::new(),
            needs_recompute: true,
            throttle: ActionThrottle::new(Duration::from_millis(75)),
            selected_index: 0,
            first_open_frame: false,
            scroll_selected_into_view: false,
        }
    }

    /// Returns whether the overlay is currently visible.
    pub fn is_open(&self) -> bool {
        self.open
    }

    /// Opens the overlay and starts a fresh search session.
    pub fn open(&mut self) {
        let Self {
            cmd_tx: _,
            open,
            query,
            matcher,
            results,
            needs_recompute,
            throttle,
            selected_index,
            first_open_frame,
            scroll_selected_into_view,
        } = self;

        if *open {
            return;
        }

        *open = true;
        query.clear();
        matcher.build_query("");
        results.clear();
        *needs_recompute = true;
        *selected_index = 0;
        *first_open_frame = true;
        *scroll_selected_into_view = false;
        throttle.reset();
    }

    /// Consumes Quick Open shortcuts before the active tab or search field can handle them.
    pub fn handle_input(&mut self, ui: &Ui, storage: &HostStorage, actions: &mut UiActions) {
        if !self.open {
            return;
        }

        self.refresh_results(storage, ui.ctx());

        let mut should_close = false;
        let mut open_index = None;
        self.handle_keys(ui, &mut open_index, &mut should_close);

        if let Some(index) = open_index {
            self.open_result(index, storage, actions);
        }

        if should_close {
            self.close();
        }
    }

    /// Renders the Quick Open overlay when it is open.
    pub fn render(&mut self, parent_ui: &Ui, storage: &HostStorage, actions: &mut UiActions) {
        if !self.open {
            return;
        }

        const PANEL_WIDTH: f32 = 520.0;
        const PANEL_ANCHOR_HEIGHT: f32 = 440.0;

        let mut open_index = None;
        let screen_rect = parent_ui.ctx().content_rect();
        let panel_pos = screen_rect.center() + vec2(0.0, -80.0 - PANEL_ANCHOR_HEIGHT * 0.5);

        let window_id = parent_ui.make_persistent_id("quick_open_window");
        let window_response = Window::new("quick_open")
            .id(window_id)
            .title_bar(false)
            .collapsible(false)
            .resizable(false)
            .scroll(false)
            .fixed_pos(panel_pos)
            .pivot(Align2::CENTER_TOP)
            .show(parent_ui.ctx(), |ui| {
                ui.set_width(PANEL_WIDTH);
                ui.vertical(|ui| {
                    ui.heading("Quick Open");
                    ui.add_space(6.0);

                    self.refresh_results(storage, ui.ctx());

                    let search_id = ui.make_persistent_id("quick_open_search");
                    let query_response = sized_singleline_text_edit(
                        ui,
                        &mut self.query,
                        vec2(ui.available_width(), 25.0),
                        7,
                    )
                    .id(search_id)
                    .hint_text("Search recent sessions and favorite files")
                    .lock_focus(true)
                    .show(ui)
                    .response;

                    if self.first_open_frame {
                        query_response.request_focus();
                        self.first_open_frame = false;
                    }

                    if query_response.changed() {
                        self.matcher.build_query(&self.query);
                        self.needs_recompute = true;
                        self.selected_index = 0;
                        self.scroll_selected_into_view = true;
                        if self.query.is_empty() {
                            self.throttle.reset();
                        } else {
                            self.throttle.delay_next();
                        }
                    }

                    self.refresh_results(storage, ui.ctx());

                    ui.add_space(8.0);
                    self.render_results(ui, &mut open_index);
                });
            });

        if let Some(index) = open_index {
            self.open_result(index, storage, actions);
        } else if window_response
            .as_ref()
            .is_some_and(|response| clicked_outside_rect(parent_ui, response.response.rect))
        {
            self.close();
        }
    }

    fn close(&mut self) {
        let Self {
            cmd_tx: _,
            open,
            query,
            matcher,
            results,
            needs_recompute,
            throttle: _,
            selected_index,
            first_open_frame,
            scroll_selected_into_view,
        } = self;

        *open = false;
        query.clear();
        matcher.build_query("");
        results.clear();
        *needs_recompute = true;
        *selected_index = 0;
        *first_open_frame = false;
        *scroll_selected_into_view = false;
    }

    fn handle_keys(&mut self, ui: &Ui, open_index: &mut Option<usize>, should_close: &mut bool) {
        if ui.input_mut(|input| input.consume_key(Modifiers::NONE, Key::Escape)) {
            *should_close = true;
            return;
        }

        let direction = ui.input_mut(|input| {
            if input.consume_key(Modifiers::NONE, Key::ArrowDown)
                || input.consume_key(Modifiers::CTRL, Key::N)
            {
                return Some(SelectionDirection::Next);
            }

            if input.consume_key(Modifiers::NONE, Key::ArrowUp)
                || input.consume_key(Modifiers::CTRL, Key::P)
            {
                return Some(SelectionDirection::Previous);
            }

            None
        });

        if let Some(direction) = direction {
            self.move_selection(direction);
        }

        if ui.input_mut(|input| {
            input.consume_key(Modifiers::NONE, Key::Enter)
                || input.consume_key(Modifiers::CTRL, Key::M)
        }) && !self.results.is_empty()
        {
            *open_index = Some(self.selected_index.min(self.results.len() - 1));
        }
    }

    fn move_selection(&mut self, direction: SelectionDirection) {
        if self.results.is_empty() {
            self.selected_index = 0;
            return;
        }

        self.selected_index = match direction {
            SelectionDirection::Previous => self
                .selected_index
                .checked_sub(1)
                .unwrap_or(self.results.len() - 1),
            SelectionDirection::Next => (self.selected_index + 1) % self.results.len(),
        };
        self.scroll_selected_into_view = true;
    }

    fn refresh_results(&mut self, storage: &HostStorage, ctx: &Context) {
        if !self.needs_recompute || !self.throttle.ready(Some(ctx)) {
            return;
        }

        self.results = search::recompute_results(storage, &mut self.matcher);
        self.needs_recompute = false;
        self.clamp_selection();
    }

    fn clamp_selection(&mut self) {
        if self.results.is_empty() {
            self.selected_index = 0;
        } else if self.selected_index >= self.results.len() {
            self.selected_index = self.results.len() - 1;
        }
    }

    fn render_results(&mut self, ui: &mut Ui, open_index: &mut Option<usize>) {
        ScrollArea::vertical()
            .id_salt("quick_open_results")
            .max_height(360.0)
            .show(ui, |ui| {
                if self.results.is_empty() {
                    ui.weak("No matching recent sessions or favorite files.");
                    return;
                }

                for (index, item) in self.results.iter().enumerate() {
                    let selected = index == self.selected_index;
                    let response = row::render_result_row(ui, item, selected);
                    if selected && self.scroll_selected_into_view {
                        response.scroll_to_me(Some(Align::Center));
                    }
                    if response.clicked() {
                        *open_index = Some(index);
                    }
                }
            });
        self.scroll_selected_into_view = false;
    }

    fn open_result(&mut self, index: usize, storage: &HostStorage, actions: &mut UiActions) {
        let Some(command) = self.open_command(index, storage) else {
            return;
        };

        if actions.try_send_command(&self.cmd_tx, command) {
            self.close();
        }
    }

    fn open_command(&mut self, index: usize, storage: &HostStorage) -> Option<HostCommand> {
        match self.results.get(index)? {
            QuickOpenItem::RecentSession { source_key, .. } => {
                let Some(snapshot) = storage
                    .recent_sessions
                    .sessions
                    .iter()
                    .find(|session| session.source_key.as_ref() == source_key.as_ref())
                    .cloned()
                else {
                    self.close();
                    return None;
                };

                let params = OpenRecentSessionParam {
                    snapshot,
                    mode: RecentSessionReopenMode::RestoreSession,
                    session_setup_id: None,
                };
                let command = HostCommand::OpenRecentSession(Box::new(params));
                Some(command)
            }
            QuickOpenItem::FavoriteFile { path, .. } => {
                let command = HostCommand::OpenFiles(vec![path.clone()]);
                Some(command)
            }
        }
    }
}
