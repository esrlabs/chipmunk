//! Filters sidebar rendering, editing, and drag-and-drop interactions.

use egui::{Color32, Grid, RichText, ScrollArea, Ui};
use tokio::sync::mpsc;
use uuid::Uuid;

use crate::{
    host::{
        common::colors::ColorPair,
        common::ui_utls::show_side_panel_group,
        ui::{UiActions, registry::filters::FilterRegistry},
    },
    session::{command::SessionCommand, ui::shared::SessionShared},
};

mod actions;
mod drag_drop;
mod render;

/// Owns Filters sidebar selection and inline-edit state.
#[derive(Debug)]
pub struct FiltersUi {
    cmd_tx: mpsc::Sender<SessionCommand>,
    selected_item: Option<SelectedSidebarItem>,
    filter_edit_state: Option<TextEditState>,
    search_value_edit_state: Option<TextEditState>,
}

#[derive(Debug, Clone)]
struct TextEditState {
    id: Uuid,
    draft: String,
    err_msg: Option<String>,
    first_render_frame: bool,
}

#[derive(Debug, Clone, Copy)]
struct FilterFlags {
    regex: bool,
    ignore_case: bool,
    word: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
enum SelectedSidebarItem {
    Filter(Uuid),
    SearchValue(Uuid),
}

impl FiltersUi {
    /// Creates the Filters sidebar UI with its session command sender.
    pub fn new(cmd_tx: mpsc::Sender<SessionCommand>) -> Self {
        Self {
            cmd_tx,
            selected_item: None,
            filter_edit_state: None,
            search_value_edit_state: None,
        }
    }

    /// Renders the sidebar lists, applies one deferred action, and then shows the editor.
    pub fn render_content(
        &mut self,
        shared: &mut SessionShared,
        actions: &mut UiActions,
        registry: &mut FilterRegistry,
        ui: &mut Ui,
    ) {
        self.clear_stale_edits(shared, registry);

        const SELECTED_GROUP_HEIGHT: f32 = 120.0;
        const SELECTED_GROUP_SEPARATOR_HEIGHT: f32 = 8.0;

        let selected_group_visible = self.selected_item.is_some();
        let reserved_editor_height = if selected_group_visible {
            SELECTED_GROUP_HEIGHT + SELECTED_GROUP_SEPARATOR_HEIGHT
        } else {
            0.0
        };
        let list_max_height = (ui.available_height() - reserved_editor_height).max(0.0);

        // Text editing and drag-and-drop are mutually exclusive across both lists.
        let dnd_enabled =
            self.filter_edit_state.is_none() && self.search_value_edit_state.is_none();
        let mut side_action = None;
        ScrollArea::vertical()
            .max_height(list_max_height)
            .show(ui, |ui| {
                self.render_filters_group(shared, registry, dnd_enabled, ui, &mut side_action);
                self.render_search_values_group(
                    shared,
                    registry,
                    dnd_enabled,
                    ui,
                    &mut side_action,
                );
            });

        self.handle_action(side_action, shared, actions, registry);
        if selected_group_visible {
            ui.separator();
            self.render_selected_group(shared, registry, ui);
        }
    }

    /// Renders the editor for the currently selected filter or chart item.
    fn render_selected_group(
        &mut self,
        shared: &mut SessionShared,
        registry: &FilterRegistry,
        ui: &mut Ui,
    ) {
        let Some(selected_item) = self.selected_item else {
            return;
        };

        // Color edits are session-local presentation changes, so they do not need
        // a search-pipeline resync. This also clears stale sidebar-local selection
        // when the semantic definition disappears from the registry.
        match selected_item {
            SelectedSidebarItem::Filter(filter_id) => {
                let filter_colors = shared
                    .filters
                    .filter_entries
                    .iter()
                    .find(|item| item.id == filter_id)
                    .map(|item| item.colors.clone());
                if registry.get_filter(&filter_id).is_some()
                    && let Some(mut filter_colors) = filter_colors
                {
                    let mut changed = false;
                    show_side_panel_group(ui, |ui| {
                        changed = Self::render_filter_editor(ui, &mut filter_colors);
                    });
                    if changed {
                        shared.set_filter_colors(&filter_id, filter_colors);
                    }
                } else {
                    self.selected_item = None;
                }
            }
            SelectedSidebarItem::SearchValue(value_id) => {
                let search_value_color = shared
                    .filters
                    .search_value_entries
                    .iter()
                    .find(|item| item.id == value_id)
                    .map(|item| item.color);
                if registry.get_search_value(&value_id).is_some()
                    && let Some(mut search_value_color) = search_value_color
                {
                    let mut changed = false;
                    show_side_panel_group(ui, |ui| {
                        changed = Self::render_search_value_editor(ui, &mut search_value_color);
                    });
                    if changed {
                        shared.set_search_value_color(&value_id, search_value_color);
                    }
                } else {
                    self.selected_item = None;
                }
            }
        }
    }

    /// Renders the selected filter color editor.
    ///
    /// Returns `true` when either color picker changed `colors`.
    fn render_filter_editor(ui: &mut Ui, colors: &mut ColorPair) -> bool {
        ui.heading(RichText::new("Filter Details").size(16.0));
        ui.add_space(10.0);

        let mut changed = false;
        Grid::new("filter_editor_colors").show(ui, |ui| {
            changed |= Self::render_color_picker_row(ui, "Foreground", &mut colors.fg);
            changed |= Self::render_color_picker_row(ui, "Background", &mut colors.bg);
        });
        changed
    }

    /// Renders the selected chart/search-value color editor.
    ///
    /// Returns `true` when the color picker changed `color`.
    fn render_search_value_editor(ui: &mut Ui, color: &mut Color32) -> bool {
        ui.heading(RichText::new("Chart Details").size(16.0));
        ui.add_space(10.0);

        let mut changed = false;
        Grid::new("search_value_editor_colors").show(ui, |ui| {
            changed |= Self::render_color_picker_row(ui, "Color", color);
        });
        changed
    }

    /// Renders one color picker row.
    ///
    /// Returns `true` when egui reports that the picker changed `color`.
    fn render_color_picker_row(ui: &mut Ui, label: &str, color: &mut Color32) -> bool {
        ui.label(label);
        let changed = ui.color_edit_button_srgba(color).changed();
        ui.end_row();
        changed
    }

    // Other session UI components can remove items while this sidebar owns their edit state.
    fn clear_stale_edits(&mut self, shared: &SessionShared, registry: &FilterRegistry) {
        if self.filter_edit_state.as_ref().is_some_and(|state| {
            !shared.filters.is_filter_applied(&state.id) || registry.get_filter(&state.id).is_none()
        }) {
            self.filter_edit_state = None;
        }
        if self.search_value_edit_state.as_ref().is_some_and(|state| {
            !shared.filters.is_search_value_applied(&state.id)
                || registry.get_search_value(&state.id).is_none()
        }) {
            self.search_value_edit_state = None;
        }
    }

    fn toggle_selected_item(&mut self, item: SelectedSidebarItem) {
        self.selected_item = match self.selected_item {
            Some(current) if current == item => None,
            _ => Some(item),
        };
    }

    fn clear_selection_for(&mut self, item: SelectedSidebarItem) {
        if self.selected_item.is_some_and(|i| i == item) {
            self.selected_item = None;
        }
    }

    fn replace_selection(&mut self, from: SelectedSidebarItem, to: SelectedSidebarItem) {
        if self.selected_item.is_some_and(|i| i == from) {
            self.selected_item = Some(to);
        }
    }

    /// Moves the active filter edit state out of `self` only for the matching row.
    fn take_filter_edit_state(&mut self, filter_id: Uuid) -> Option<TextEditState> {
        if self
            .filter_edit_state
            .as_ref()
            .is_some_and(|state| state.id == filter_id)
        {
            return self.filter_edit_state.take();
        }

        None
    }

    /// Clears the active filter edit state when it still belongs to `filter_id`.
    fn clear_filter_edit_for(&mut self, filter_id: Uuid) {
        if self
            .filter_edit_state
            .as_ref()
            .is_some_and(|state| state.id == filter_id)
        {
            self.filter_edit_state = None;
        }
    }

    /// Moves the active chart edit state out of `self` only for the matching row.
    fn take_search_value_edit_state(&mut self, value_id: Uuid) -> Option<TextEditState> {
        if self
            .search_value_edit_state
            .as_ref()
            .is_some_and(|state| state.id == value_id)
        {
            return self.search_value_edit_state.take();
        }

        None
    }

    /// Clears the active chart edit state when it still belongs to `value_id`.
    fn clear_search_value_edit_for(&mut self, value_id: Uuid) {
        if self
            .search_value_edit_state
            .as_ref()
            .is_some_and(|state| state.id == value_id)
        {
            self.search_value_edit_state = None;
        }
    }
}

impl TextEditState {
    fn new(id: Uuid, draft: String) -> Self {
        Self {
            id,
            draft,
            err_msg: None,
            first_render_frame: true,
        }
    }

    fn is_valid(&self) -> bool {
        self.err_msg.is_none()
    }
}
