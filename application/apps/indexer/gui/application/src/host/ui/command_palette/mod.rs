//! Host-level Command Palette overlay for application commands.

use egui::{Align, Align2, Key, Modifiers, ScrollArea, Ui, Window, vec2};
use tokio::sync::mpsc::Sender;

use crate::{
    common::{matcher::fuzzy_matcher::FuzzyMatcher, ui::search_picker::SearchPickerText},
    host::{
        command::HostCommand,
        common::ui_utls::{clicked_outside_rect, sized_singleline_text_edit},
        ui::{UiActions, state::HostState, storage::HostStorage, tabs::HostTabs},
    },
};

use commands::CommandAction;

mod commands;
mod row;

/// Searchable launcher for global application commands.
#[derive(Debug)]
pub struct CommandPalette {
    cmd_tx: Sender<HostCommand>,
    open: bool,
    query: String,
    matcher: FuzzyMatcher,
    results: Vec<CommandPaletteItem>,
    selected_index: usize,
    /// True until the search field receives focus after opening.
    first_open_frame: bool,
    scroll_selected_into_view: bool,
}

/// Cached result item containing display text and the action to execute.
#[derive(Debug, Clone)]
struct CommandPaletteItem {
    title: SearchPickerText,
    action: CommandAction,
}

#[derive(Debug, Clone, Copy)]
enum SelectionDirection {
    Previous,
    Next,
}

impl CommandPalette {
    /// Creates a closed Command Palette overlay.
    pub fn new(cmd_tx: Sender<HostCommand>) -> Self {
        let mut matcher = FuzzyMatcher::default();
        matcher.build_query("");
        let results = commands::recompute_results(&mut matcher);

        Self {
            cmd_tx,
            open: false,
            query: String::new(),
            matcher,
            results,
            selected_index: 0,
            first_open_frame: false,
            scroll_selected_into_view: false,
        }
    }

    /// Returns whether the overlay is currently visible.
    pub fn is_open(&self) -> bool {
        self.open
    }

    /// Opens the overlay and starts a fresh command search session.
    pub fn open(&mut self) {
        let Self {
            cmd_tx: _,
            open,
            query,
            matcher,
            results,
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
        *results = commands::recompute_results(matcher);
        *selected_index = 0;
        *first_open_frame = true;
        *scroll_selected_into_view = false;
    }

    /// Consumes Command Palette keyboard input while the overlay is open.
    pub fn handle_input(
        &mut self,
        ui: &Ui,
        state: &mut HostState,
        tabs: &mut HostTabs,
        storage: &HostStorage,
        actions: &mut UiActions,
    ) {
        if !self.open {
            return;
        }

        let mut should_close = false;
        let mut execute_index = None;
        self.handle_keys(ui, &mut execute_index, &mut should_close);

        if let Some(index) = execute_index {
            self.execute_result(index, state, tabs, storage, actions, ui);
        } else if should_close {
            self.close();
        }
    }

    /// Renders the Command Palette overlay when it is open.
    pub fn render(
        &mut self,
        parent_ui: &Ui,
        state: &mut HostState,
        tabs: &mut HostTabs,
        storage: &HostStorage,
        actions: &mut UiActions,
    ) {
        if !self.open {
            return;
        }

        const PANEL_WIDTH: f32 = 520.0;
        const PANEL_ANCHOR_HEIGHT: f32 = 440.0;

        let mut execute_index = None;
        let screen_rect = parent_ui.ctx().content_rect();
        let panel_pos = screen_rect.center() + vec2(0.0, -80.0 - PANEL_ANCHOR_HEIGHT * 0.5);

        let window_id = parent_ui.make_persistent_id("command_palette_window");
        let window_response = Window::new("command_palette")
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
                    ui.heading("Command Palette");
                    ui.add_space(6.0);

                    let search_id = ui.make_persistent_id("command_palette_search");
                    let query_response = sized_singleline_text_edit(
                        ui,
                        &mut self.query,
                        vec2(ui.available_width(), 25.0),
                        7,
                    )
                    .id(search_id)
                    .hint_text("Search commands")
                    .lock_focus(true)
                    .show(ui)
                    .response;

                    if self.first_open_frame {
                        query_response.request_focus();
                        self.first_open_frame = false;
                    }

                    if query_response.changed() {
                        self.matcher.build_query(&self.query);
                        self.results = commands::recompute_results(&mut self.matcher);
                        self.selected_index = 0;
                        self.scroll_selected_into_view = true;
                    }

                    ui.add_space(8.0);
                    self.render_results(ui, &mut execute_index);
                });
            });

        if let Some(index) = execute_index {
            self.execute_result(index, state, tabs, storage, actions, parent_ui);
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
            selected_index,
            first_open_frame,
            scroll_selected_into_view,
        } = self;

        *open = false;
        query.clear();
        matcher.build_query("");
        *results = commands::recompute_results(matcher);
        *selected_index = 0;
        *first_open_frame = false;
        *scroll_selected_into_view = false;
    }

    fn handle_keys(&mut self, ui: &Ui, execute_index: &mut Option<usize>, should_close: &mut bool) {
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
            *execute_index = Some(self.selected_index.min(self.results.len() - 1));
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

    fn render_results(&mut self, ui: &mut Ui, execute_index: &mut Option<usize>) {
        ScrollArea::vertical()
            .id_salt("command_palette_results")
            .max_height(360.0)
            .show(ui, |ui| {
                if self.results.is_empty() {
                    ui.weak("No matching commands.");
                    return;
                }

                for (index, item) in self.results.iter().enumerate() {
                    let selected = index == self.selected_index;
                    let response = row::render_result_row(ui, item, selected);
                    if selected && self.scroll_selected_into_view {
                        response.scroll_to_me(Some(Align::Center));
                    }
                    if response.clicked() {
                        *execute_index = Some(index);
                    }
                }
            });
        self.scroll_selected_into_view = false;
    }

    fn execute_result(
        &mut self,
        index: usize,
        state: &mut HostState,
        tabs: &mut HostTabs,
        storage: &HostStorage,
        actions: &mut UiActions,
        ui: &Ui,
    ) {
        let Some(item) = self.results.get(index) else {
            return;
        };

        if commands::execute_action(item.action, &self.cmd_tx, state, tabs, storage, actions, ui) {
            self.close();
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn open_resets_query_and_results() {
        let (cmd_tx, _cmd_rx) = tokio::sync::mpsc::channel(1);
        let mut palette = CommandPalette::new(cmd_tx);
        palette.query = "plugin".to_owned();
        palette.matcher.build_query(&palette.query);
        palette.results = commands::recompute_results(&mut palette.matcher);

        palette.open();

        assert!(palette.is_open());
        assert!(palette.query.is_empty());
        assert!(palette.results.len() > 20);
        assert_eq!(palette.selected_index, 0);
    }
}
