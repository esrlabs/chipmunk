use egui::{Align, Frame, Layout, Margin, RichText, ScrollArea, Ui, vec2};
use tokio::sync::mpsc;
use uuid::Uuid;

use crate::{
    common::phosphor::icons,
    common::search_value_validation::SearchValueEligibility,
    host::ui::{
        UiActions,
        registry::filters::{FilterDefinition, FilterRegistry, SearchValueDefinition},
    },
    session::{
        command::SessionCommand,
        ui::shared::{SearchSyncTarget, SessionShared},
    },
};

#[derive(Debug, Clone, Copy)]
/// Pending action selected from the Filters side panel.
enum FilterPanelAction {
    ToggleFilter(Uuid, bool),
    RemoveFilter(Uuid),
    MoveFilterToValue(Uuid),
    ToggleSearchValue(Uuid, bool),
    RemoveSearchValue(Uuid),
    MoveValueToFilter(Uuid),
}

#[allow(unused)]
#[derive(Debug)]
pub struct FiltersUi {
    cmd_tx: mpsc::Sender<SessionCommand>,
}

impl FiltersUi {
    pub fn new(cmd_tx: mpsc::Sender<SessionCommand>) -> Self {
        Self { cmd_tx }
    }

    pub fn render_content(
        &mut self,
        shared: &mut SessionShared,
        actions: &mut UiActions,
        registry: &mut FilterRegistry,
        ui: &mut Ui,
    ) {
        ui.vertical(|ui| {
            ui.heading(RichText::new("Filters").size(16.0));
            ui.add_space(5.0);

            ScrollArea::vertical().show(ui, |ui| {
                let mut side_action = None;
                self.render_filters_section(shared, registry, ui, &mut side_action);

                ui.add_space(8.0);
                ui.heading(RichText::new("Charts").size(16.0));
                ui.add_space(5.0);
                self.render_search_values_section(shared, registry, ui, &mut side_action);

                self.handle_action(side_action, shared, actions, registry);
            });
        });
    }

    fn render_filters_section(
        &self,
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
        &self,
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

    fn handle_action(
        &self,
        side_action: Option<FilterPanelAction>,
        shared: &mut SessionShared,
        actions: &mut UiActions,
        registry: &mut FilterRegistry,
    ) {
        match side_action {
            Some(FilterPanelAction::ToggleFilter(filter_id, enabled)) => {
                if shared.filters.set_filter_enabled(&filter_id, enabled) {
                    shared
                        .sync_search_pipelines(registry, SearchSyncTarget::Filter)
                        .into_iter()
                        .for_each(|cmd| _ = actions.try_send_command(&self.cmd_tx, cmd));
                }
            }
            Some(FilterPanelAction::RemoveFilter(filter_id)) => {
                shared.filters.unapply_filter(registry, &filter_id);
                shared
                    .sync_search_pipelines(registry, SearchSyncTarget::Filter)
                    .into_iter()
                    .for_each(|cmd| _ = actions.try_send_command(&self.cmd_tx, cmd));
            }
            Some(FilterPanelAction::MoveFilterToValue(filter_id)) => {
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
                    shared
                        .sync_search_pipelines(registry, SearchSyncTarget::Both)
                        .into_iter()
                        .for_each(|cmd| _ = actions.try_send_command(&self.cmd_tx, cmd));
                }
            }
            Some(FilterPanelAction::ToggleSearchValue(value_id, enabled)) => {
                if shared.filters.set_search_value_enabled(&value_id, enabled) {
                    shared
                        .sync_search_pipelines(registry, SearchSyncTarget::SearchValue)
                        .into_iter()
                        .for_each(|cmd| _ = actions.try_send_command(&self.cmd_tx, cmd));
                }
            }
            Some(FilterPanelAction::RemoveSearchValue(value_id)) => {
                shared.filters.unapply_search_value(registry, &value_id);
                shared
                    .sync_search_pipelines(registry, SearchSyncTarget::SearchValue)
                    .into_iter()
                    .for_each(|cmd| _ = actions.try_send_command(&self.cmd_tx, cmd));
            }
            Some(FilterPanelAction::MoveValueToFilter(value_id)) => {
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
                    shared
                        .sync_search_pipelines(registry, SearchSyncTarget::Both)
                        .into_iter()
                        .for_each(|cmd| _ = actions.try_send_command(&self.cmd_tx, cmd));
                }
            }
            None => {}
        }
    }

    fn render_filter_item(
        &self,
        ui: &mut Ui,
        filter_id: Uuid,
        enabled: bool,
        filter_def: &FilterDefinition,
        side_action: &mut Option<FilterPanelAction>,
    ) {
        let eligibility = &filter_def.search_value_eligibility;

        Frame::group(ui.style())
            .fill(ui.visuals().faint_bg_color)
            .inner_margin(Margin::symmetric(8, 4))
            .show(ui, |ui| {
                ui.horizontal(|ui| {
                    let mut enabled_state = enabled;
                    let checkbox = ui.checkbox(&mut enabled_state, "").on_hover_ui(|ui| {
                        ui.set_max_width(ui.spacing().tooltip_width);
                        let tooltip = if enabled {
                            "Disable this filter temporarily."
                        } else {
                            "Enable this filter again."
                        };
                        ui.label(tooltip);
                    });
                    if checkbox.changed() {
                        *side_action =
                            Some(FilterPanelAction::ToggleFilter(filter_id, enabled_state));
                    }

                    let (res, painter) =
                        ui.allocate_painter(vec2(10.0, 20.0), egui::Sense::hover());
                    painter.rect_filled(res.rect, 2.0, filter_def.colors.bg);

                    ui.label(&filter_def.filter.value);

                    ui.with_layout(Layout::right_to_left(Align::Center), |ui| {
                        let move_btn = ui
                            .add_enabled(
                                eligibility.is_eligible(),
                                egui::Button::new(
                                    RichText::new(icons::regular::CHART_LINE).size(14.0),
                                ),
                            )
                            .on_hover_text("Move to Charts");
                        if let SearchValueEligibility::Ineligible { reason } = eligibility {
                            move_btn.on_disabled_hover_text(format!("Chart: {reason}"));
                        } else if move_btn.clicked() {
                            *side_action = Some(FilterPanelAction::MoveFilterToValue(filter_id));
                        }

                        if ui
                            .button(RichText::new(icons::regular::TRASH).size(14.0))
                            .on_hover_text("Remove filter from session")
                            .clicked()
                        {
                            *side_action = Some(FilterPanelAction::RemoveFilter(filter_id));
                        }
                    });
                });
            });
    }

    fn render_search_value_item(
        &self,
        ui: &mut Ui,
        value_id: Uuid,
        enabled: bool,
        value_def: &SearchValueDefinition,
        side_action: &mut Option<FilterPanelAction>,
    ) {
        Frame::group(ui.style())
            .fill(ui.visuals().faint_bg_color)
            .inner_margin(Margin::symmetric(8, 4))
            .show(ui, |ui| {
                ui.horizontal(|ui| {
                    let mut enabled_state = enabled;
                    let checkbox = ui.checkbox(&mut enabled_state, "").on_hover_ui(|ui| {
                        ui.set_max_width(ui.spacing().tooltip_width);
                        let tooltip = if enabled {
                            "Disable this Chart temporarily."
                        } else {
                            "Enable this Chart again."
                        };
                        ui.label(tooltip);
                    });
                    if checkbox.changed() {
                        *side_action = Some(FilterPanelAction::ToggleSearchValue(
                            value_id,
                            enabled_state,
                        ));
                    }

                    let (res, painter) =
                        ui.allocate_painter(vec2(10.0, 20.0), egui::Sense::hover());
                    painter.rect_filled(res.rect, 2.0, value_def.color);

                    ui.label(&value_def.filter.value);

                    ui.with_layout(Layout::right_to_left(Align::Center), |ui| {
                        if ui
                            .button(RichText::new(icons::regular::FUNNEL).size(14.0))
                            .on_hover_text("Move to Filter")
                            .clicked()
                        {
                            *side_action = Some(FilterPanelAction::MoveValueToFilter(value_id));
                        }

                        if ui
                            .button(RichText::new(icons::regular::TRASH).size(14.0))
                            .on_hover_text("Remove chart from session")
                            .clicked()
                        {
                            *side_action = Some(FilterPanelAction::RemoveSearchValue(value_id));
                        }
                    });
                });
            });
    }
}
