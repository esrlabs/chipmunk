use egui::{Align, Frame, Layout, RichText, ScrollArea, Sense, Sides, Ui, UiBuilder, vec2};
use tokio::sync::mpsc;
use uuid::Uuid;

use crate::{
    common::phosphor::icons,
    common::search_value_validation::SearchValueEligibility,
    host::{
        common::ui_utls::show_side_panel_group,
        ui::{
            UiActions,
            registry::filters::{FilterDefinition, FilterRegistry, SearchValueDefinition},
        },
    },
    session::{
        command::SessionCommand,
        ui::shared::{SearchSyncTarget, SessionShared},
    },
};

#[derive(Debug, Clone, Copy)]
/// Pending action selected from the Filters side panel.
///
/// # Note:
///
/// We are using actions here because we can't apply changes on the state while
/// we are iterating through them.
enum FilterPanelAction {
    ToggleFilter(Uuid, bool),
    RemoveFilter(Uuid),
    MoveFilterToValue(Uuid),
    ToggleSearchValue(Uuid, bool),
    RemoveSearchValue(Uuid),
    MoveValueToFilter(Uuid),
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum SelectedSidebarItem {
    Filter(Uuid),
    SearchValue(Uuid),
}

#[derive(Debug)]
pub struct FiltersUi {
    cmd_tx: mpsc::Sender<SessionCommand>,
    selected_item: Option<SelectedSidebarItem>,
}

impl FiltersUi {
    pub fn new(cmd_tx: mpsc::Sender<SessionCommand>) -> Self {
        Self {
            cmd_tx,
            selected_item: None,
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
        ScrollArea::vertical().show(ui, |ui| {
            // Render both lists first, then apply the deferred row action once,
            // and finally refresh the selected editor against the latest state.
            let mut side_action = None;
            self.render_filters_group(shared, registry, ui, &mut side_action);
            self.render_search_values_group(shared, registry, ui, &mut side_action);

            self.handle_action(side_action, shared, actions, registry);
            self.render_selected_group(shared, registry, ui);
        });
    }

    fn render_filters_group(
        &mut self,
        shared: &SessionShared,
        registry: &FilterRegistry,
        ui: &mut Ui,
        side_action: &mut Option<FilterPanelAction>,
    ) {
        show_side_panel_group(ui, |ui| {
            let filters_count = shared.filters.filter_entries.len();
            Self::render_group_heading(ui, "Filters", filters_count);
            ui.add_space(5.0);
            self.render_filters_section(shared, registry, ui, side_action);
        });
    }

    fn render_search_values_group(
        &mut self,
        shared: &SessionShared,
        registry: &FilterRegistry,
        ui: &mut Ui,
        side_action: &mut Option<FilterPanelAction>,
    ) {
        show_side_panel_group(ui, |ui| {
            let charts_count = shared.filters.search_value_entries.len();
            Self::render_group_heading(ui, "Charts", charts_count);
            ui.add_space(5.0);
            self.render_search_values_section(shared, registry, ui, side_action);
        });
    }

    fn render_filters_section(
        &mut self,
        shared: &SessionShared,
        registry: &FilterRegistry,
        ui: &mut Ui,
        side_action: &mut Option<FilterPanelAction>,
    ) {
        let mut have_items = false;
        shared
            .filters
            .filter_entries
            .iter()
            .filter_map(|item| {
                registry
                    .get_filter(&item.id)
                    .map(|def| (item.id, item.enabled, def.clone()))
            })
            .for_each(|(filter_id, enabled, filter_def)| {
                have_items = true;
                self.render_filter_item(ui, filter_id, enabled, &filter_def, side_action);
            });

        if !have_items {
            ui.label(RichText::new("No filters applied").weak());
        }
    }

    fn render_search_values_section(
        &mut self,
        shared: &SessionShared,
        registry: &FilterRegistry,
        ui: &mut Ui,
        side_action: &mut Option<FilterPanelAction>,
    ) {
        let mut has_items = false;
        shared
            .filters
            .search_value_entries
            .iter()
            .filter_map(|item| {
                registry
                    .get_search_value(&item.id)
                    .map(|def| (item.id, item.enabled, def.clone()))
            })
            .for_each(|(value_id, enabled, value_def)| {
                has_items = true;
                self.render_search_value_item(ui, value_id, enabled, &value_def, side_action);
            });

        if !has_items {
            ui.label(RichText::new("No Charts applied").weak());
        }
    }

    fn render_filter_item(
        &mut self,
        ui: &mut Ui,
        filter_id: Uuid,
        enabled: bool,
        filter_def: &FilterDefinition,
        side_action: &mut Option<FilterPanelAction>,
    ) {
        let eligibility = &filter_def.search_value_eligibility;
        self.render_sidebar_item(ui, SelectedSidebarItem::Filter(filter_id), |ui| {
            let (left_action, right_action) = Sides::new().shrink_left().truncate().show(
                ui,
                |ui| {
                    let mut action = None;

                    if Self::render_enabled_checkbox(
                        ui,
                        enabled,
                        "Disable this filter temporarily.",
                        "Enable this filter again.",
                    ) {
                        action = Some(FilterPanelAction::ToggleFilter(filter_id, !enabled));
                    }

                    Self::render_color_swatch(ui, filter_def.colors.bg);
                    ui.label(&filter_def.filter.value);

                    action
                },
                |ui| {
                    let mut action = None;

                    let move_btn = ui
                        .add_enabled(
                            eligibility.is_eligible(),
                            egui::Button::new(RichText::new(icons::regular::CHART_LINE).size(14.0)),
                        )
                        .on_hover_text("Move to Charts");
                    if let SearchValueEligibility::Ineligible { reason } = eligibility {
                        move_btn.on_disabled_hover_text(format!("Chart: {reason}"));
                    } else if move_btn.clicked() {
                        action = Some(FilterPanelAction::MoveFilterToValue(filter_id));
                    }

                    let remove_btn = ui
                        .button(RichText::new(icons::regular::TRASH).size(14.0))
                        .on_hover_text("Remove filter from session");
                    if remove_btn.clicked() {
                        action = Some(FilterPanelAction::RemoveFilter(filter_id));
                    }

                    action
                },
            );

            if let Some(action) = left_action.or(right_action) {
                *side_action = Some(action);
            }
        });
    }

    fn render_search_value_item(
        &mut self,
        ui: &mut Ui,
        value_id: Uuid,
        enabled: bool,
        value_def: &SearchValueDefinition,
        side_action: &mut Option<FilterPanelAction>,
    ) {
        self.render_sidebar_item(ui, SelectedSidebarItem::SearchValue(value_id), |ui| {
            let (left_action, right_action) = Sides::new().shrink_left().truncate().show(
                ui,
                |ui| {
                    let mut action = None;

                    if Self::render_enabled_checkbox(
                        ui,
                        enabled,
                        "Disable this Chart temporarily.",
                        "Enable this Chart again.",
                    ) {
                        action = Some(FilterPanelAction::ToggleSearchValue(value_id, !enabled));
                    }

                    Self::render_color_swatch(ui, value_def.color);
                    ui.label(&value_def.filter.value);

                    action
                },
                |ui| {
                    let mut action = None;

                    let move_btn = ui
                        .button(RichText::new(icons::regular::FUNNEL).size(14.0))
                        .on_hover_text("Move to Filter");
                    if move_btn.clicked() {
                        action = Some(FilterPanelAction::MoveValueToFilter(value_id));
                    }

                    let remove_btn = ui
                        .button(RichText::new(icons::regular::TRASH).size(14.0))
                        .on_hover_text("Remove chart from session");
                    if remove_btn.clicked() {
                        action = Some(FilterPanelAction::RemoveSearchValue(value_id));
                    }

                    action
                },
            );

            if let Some(action) = left_action.or(right_action) {
                *side_action = Some(action);
            }
        });
    }

    /// Renders one selectable sidebar row while preserving child widget interactions.
    fn render_sidebar_item<F>(&mut self, ui: &mut Ui, item: SelectedSidebarItem, render_ui: F)
    where
        F: FnOnce(&mut Ui),
    {
        let is_selected = self.selected_item.is_some_and(|current| current == item);

        const ITEM_ROW_HEIGHT: f32 = 30.0;
        let desired_size = vec2(ui.available_width(), ITEM_ROW_HEIGHT);
        let (_, item_response) = ui.allocate_exact_size(desired_size, Sense::click());

        // Keep one explicit row-sized selection target while child widgets render
        // inside the same rect and retain their own interaction handling.
        ui.scope_builder(
            UiBuilder::new()
                .max_rect(item_response.rect)
                .layout(Layout::left_to_right(Align::Center)),
            |ui| {
                let visuals = ui.visuals();
                let mut frame = Frame::group(ui.style()).fill(visuals.faint_bg_color);
                if is_selected {
                    frame = frame
                        .fill(visuals.widgets.active.bg_fill)
                        .stroke(visuals.selection.stroke);
                }

                frame.show(ui, |ui| {
                    render_ui(ui);
                });
            },
        );

        if item_response
            .on_hover_cursor(egui::CursorIcon::PointingHand)
            .clicked()
        {
            self.toggle_selected_item(item);
        }
    }

    /// Renders the editor for the currently selected filter or chart item.
    fn render_selected_group(
        &mut self,
        shared: &SessionShared,
        registry: &mut FilterRegistry,
        ui: &mut Ui,
    ) {
        let Some(selected_item) = self.selected_item else {
            return;
        };

        // Color edits update registry-owned presentation data only, so they do not
        // need a search-pipeline resync. This is also where stale sidebar-local
        // selection is cleared if the backing item no longer exists.
        match selected_item {
            SelectedSidebarItem::Filter(filter_id) => {
                if shared.filters.is_filter_applied(&filter_id)
                    && let Some(filter_def) = registry.get_filter_mut(&filter_id)
                {
                    show_side_panel_group(ui, |ui| {
                        Self::render_filter_editor(ui, filter_def);
                    });
                } else {
                    self.selected_item = None;
                }
            }
            SelectedSidebarItem::SearchValue(value_id) => {
                if shared.filters.is_search_value_applied(&value_id)
                    && let Some(value_def) = registry.get_search_value_mut(&value_id)
                {
                    show_side_panel_group(ui, |ui| {
                        Self::render_search_value_editor(ui, value_def);
                    });
                } else {
                    self.selected_item = None;
                }
            }
        }
    }

    fn render_filter_editor(ui: &mut Ui, filter_def: &mut FilterDefinition) {
        ui.heading(RichText::new("Filter Details").size(16.0));
        ui.add_space(10.0);

        Self::render_color_picker_row(ui, "Foreground", &mut filter_def.colors.fg);
        Self::render_color_picker_row(ui, "Background", &mut filter_def.colors.bg);
    }

    fn render_search_value_editor(ui: &mut Ui, value_def: &mut SearchValueDefinition) {
        ui.heading(RichText::new("Chart Details").size(16.0));
        ui.add_space(10.0);

        Self::render_color_picker_row(ui, "Color", &mut value_def.color);
    }

    /// Renders the enabled/disabled checkbox and returns whether the user
    /// toggled it in this frame.
    ///
    /// The returned flag is a change signal only; callers already know the
    /// current state and derive the next state themselves.
    fn render_enabled_checkbox(
        ui: &mut Ui,
        enabled: bool,
        disabled_tooltip: &str,
        enabled_tooltip: &str,
    ) -> bool {
        let mut enabled_state = enabled;
        let checkbox = ui.checkbox(&mut enabled_state, "").on_hover_ui(|ui| {
            ui.set_max_width(ui.spacing().tooltip_width);

            let tooltip = if enabled {
                disabled_tooltip
            } else {
                enabled_tooltip
            };
            ui.label(tooltip);
        });
        checkbox.changed()
    }

    fn render_group_heading(ui: &mut Ui, title: &str, count: usize) {
        ui.horizontal_wrapped(|ui| {
            ui.label(RichText::new(title).heading().size(16.0));
            ui.label(RichText::new(format!("({count})")).weak().size(16.0));
        });
    }

    fn render_color_picker_row(ui: &mut Ui, label: &str, color: &mut egui::Color32) {
        ui.horizontal(|ui| {
            ui.label(label);
            ui.color_edit_button_srgba(color);
        });
    }

    fn render_color_swatch(ui: &mut Ui, color: egui::Color32) {
        const ITEM_SWATCH_SIZE: egui::Vec2 = vec2(10.0, 20.0);

        let (response, painter) = ui.allocate_painter(ITEM_SWATCH_SIZE, Sense::hover());
        painter.rect_filled(response.rect, 2.0, color);
    }

    /// Applies the queued sidebar mutation and dispatches any required pipeline sync commands.
    fn handle_action(
        &mut self,
        side_action: Option<FilterPanelAction>,
        shared: &mut SessionShared,
        actions: &mut UiActions,
        registry: &mut FilterRegistry,
    ) {
        let Some(side_action) = side_action else {
            return;
        };
        // Apply the queued row mutation after rendering so we don't mutate the
        // session/registry state while iterating it to build the current UI frame.
        match side_action {
            FilterPanelAction::ToggleFilter(filter_id, enabled) => {
                if shared.filters.set_filter_enabled(&filter_id, enabled) {
                    shared
                        .sync_search_pipelines(registry, SearchSyncTarget::Filter)
                        .into_iter()
                        .for_each(|cmd| _ = actions.try_send_command(&self.cmd_tx, cmd));
                }
            }
            FilterPanelAction::RemoveFilter(filter_id) => {
                self.clear_selection_for(SelectedSidebarItem::Filter(filter_id));
                shared.filters.unapply_filter(registry, &filter_id);
                shared
                    .sync_search_pipelines(registry, SearchSyncTarget::Filter)
                    .into_iter()
                    .for_each(|cmd| _ = actions.try_send_command(&self.cmd_tx, cmd));
            }
            FilterPanelAction::MoveFilterToValue(filter_id) => {
                let was_applied = shared.filters.is_filter_applied(&filter_id);
                let was_enabled = shared.filters.is_filter_enabled(&filter_id);
                let session_id = shared.get_id();
                let converted_value = registry.convert_filter_to_value(filter_id, session_id);
                if let Some(value_id) = converted_value
                    && was_applied
                {
                    shared.filters.unapply_filter(registry, &filter_id);
                    shared
                        .filters
                        .apply_search_value_with_state(registry, value_id, was_enabled);
                    self.replace_selection(
                        SelectedSidebarItem::Filter(filter_id),
                        SelectedSidebarItem::SearchValue(value_id),
                    );
                    shared
                        .sync_search_pipelines(registry, SearchSyncTarget::Both)
                        .into_iter()
                        .for_each(|cmd| _ = actions.try_send_command(&self.cmd_tx, cmd));
                }
            }
            FilterPanelAction::ToggleSearchValue(value_id, enabled) => {
                if shared.filters.set_search_value_enabled(&value_id, enabled) {
                    shared
                        .sync_search_pipelines(registry, SearchSyncTarget::SearchValue)
                        .into_iter()
                        .for_each(|cmd| _ = actions.try_send_command(&self.cmd_tx, cmd));
                }
            }
            FilterPanelAction::RemoveSearchValue(value_id) => {
                self.clear_selection_for(SelectedSidebarItem::SearchValue(value_id));
                shared.filters.unapply_search_value(registry, &value_id);
                shared
                    .sync_search_pipelines(registry, SearchSyncTarget::SearchValue)
                    .into_iter()
                    .for_each(|cmd| _ = actions.try_send_command(&self.cmd_tx, cmd));
            }
            FilterPanelAction::MoveValueToFilter(value_id) => {
                let was_applied = shared.filters.is_search_value_applied(&value_id);
                let was_enabled = shared.filters.is_search_value_enabled(&value_id);
                let session_id = shared.get_id();
                let converted_filter = registry.convert_value_to_filter(value_id, session_id);
                if let Some(filter_id) = converted_filter
                    && was_applied
                {
                    shared.filters.unapply_search_value(registry, &value_id);
                    shared
                        .filters
                        .apply_filter_with_state(registry, filter_id, was_enabled);
                    self.replace_selection(
                        SelectedSidebarItem::SearchValue(value_id),
                        SelectedSidebarItem::Filter(filter_id),
                    );
                    shared
                        .sync_search_pipelines(registry, SearchSyncTarget::Both)
                        .into_iter()
                        .for_each(|cmd| _ = actions.try_send_command(&self.cmd_tx, cmd));
                }
            }
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
}

#[cfg(test)]
mod tests {
    use crate::session::command::SessionCommand;
    use tokio::sync::mpsc;
    use uuid::Uuid;

    use super::{FiltersUi, SelectedSidebarItem};

    fn new_ui() -> FiltersUi {
        let (cmd_tx, _cmd_rx) = mpsc::channel::<SessionCommand>(4);
        FiltersUi::new(cmd_tx)
    }

    #[test]
    fn selecting_same_toggles() {
        let mut ui = new_ui();
        let filter_id = Uuid::new_v4();

        ui.toggle_selected_item(SelectedSidebarItem::Filter(filter_id));
        ui.toggle_selected_item(SelectedSidebarItem::Filter(filter_id));

        assert_eq!(ui.selected_item, None);
    }

    #[test]
    fn selecting_other_replaces() {
        let mut ui = new_ui();
        let first = Uuid::new_v4();
        let second = Uuid::new_v4();

        ui.toggle_selected_item(SelectedSidebarItem::Filter(first));
        ui.toggle_selected_item(SelectedSidebarItem::SearchValue(second));

        assert_eq!(
            ui.selected_item,
            Some(SelectedSidebarItem::SearchValue(second))
        );
    }

    #[test]
    fn removing_selected_clears() {
        let mut ui = new_ui();
        let filter_id = Uuid::new_v4();
        ui.selected_item = Some(SelectedSidebarItem::Filter(filter_id));

        ui.clear_selection_for(SelectedSidebarItem::Filter(filter_id));

        assert_eq!(ui.selected_item, None);
    }

    #[test]
    fn moving_filter_follows() {
        let mut ui = new_ui();
        let filter_id = Uuid::new_v4();
        let value_id = Uuid::new_v4();
        ui.selected_item = Some(SelectedSidebarItem::Filter(filter_id));

        ui.replace_selection(
            SelectedSidebarItem::Filter(filter_id),
            SelectedSidebarItem::SearchValue(value_id),
        );

        assert_eq!(
            ui.selected_item,
            Some(SelectedSidebarItem::SearchValue(value_id))
        );
    }

    #[test]
    fn moving_value_follows() {
        let mut ui = new_ui();
        let filter_id = Uuid::new_v4();
        let value_id = Uuid::new_v4();
        ui.selected_item = Some(SelectedSidebarItem::SearchValue(value_id));

        ui.replace_selection(
            SelectedSidebarItem::SearchValue(value_id),
            SelectedSidebarItem::Filter(filter_id),
        );

        assert_eq!(
            ui.selected_item,
            Some(SelectedSidebarItem::Filter(filter_id))
        );
    }
}
