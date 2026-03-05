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
    RemoveFilter(Uuid),
    MoveFilterToValue(Uuid),
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
                ui.heading(RichText::new("Search Values").size(16.0));
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
        let applied_filters: Vec<_> = shared
            .filters
            .applied_filters
            .iter()
            .filter_map(|id| registry.get_filter(id).map(|def| (*id, def.clone())))
            .collect();

        if applied_filters.is_empty() {
            ui.label(RichText::new("No filters applied").weak());
            return;
        }

        for (filter_id, filter_def) in applied_filters {
            self.render_filter_item(ui, filter_id, &filter_def, side_action);
        }
    }

    fn render_search_values_section(
        &self,
        shared: &SessionShared,
        registry: &FilterRegistry,
        ui: &mut Ui,
        side_action: &mut Option<FilterPanelAction>,
    ) {
        let applied_values: Vec<_> = shared
            .filters
            .applied_search_values
            .iter()
            .filter_map(|id| registry.get_search_value(id).map(|def| (*id, def.clone())))
            .collect();

        if applied_values.is_empty() {
            ui.label(RichText::new("No search values applied").weak());
            return;
        }

        for (value_id, value_def) in applied_values {
            self.render_search_value_item(ui, value_id, &value_def, side_action);
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
            Some(FilterPanelAction::RemoveFilter(filter_id)) => {
                shared.filters.unapply_filter(registry, &filter_id);
                shared
                    .sync_search_pipelines(registry, SearchSyncTarget::Filter)
                    .into_iter()
                    .for_each(|cmd| _ = actions.try_send_command(&self.cmd_tx, cmd));
            }
            Some(FilterPanelAction::MoveFilterToValue(filter_id)) => {
                let was_applied = shared.filters.is_filter_applied(&filter_id);
                let session_id = shared.get_id();
                let converted_value = registry.convert_filter_to_value(filter_id, session_id);
                if let Some(value_id) = converted_value
                    && was_applied
                {
                    shared.filters.unapply_filter(registry, &filter_id);
                    shared.filters.apply_search_value(registry, value_id);
                    shared
                        .sync_search_pipelines(registry, SearchSyncTarget::Both)
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
                let session_id = shared.get_id();
                let converted_filter = registry.convert_value_to_filter(value_id, session_id);
                if let Some(filter_id) = converted_filter
                    && was_applied
                {
                    shared.filters.unapply_search_value(registry, &value_id);
                    shared.filters.apply_filter(registry, filter_id);
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
        filter_def: &FilterDefinition,
        side_action: &mut Option<FilterPanelAction>,
    ) {
        let eligibility = &filter_def.search_value_eligibility;

        Frame::group(ui.style())
            .fill(ui.visuals().faint_bg_color)
            .inner_margin(Margin::symmetric(8, 4))
            .show(ui, |ui| {
                ui.horizontal(|ui| {
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
                            .on_hover_text("Move to Search Value");
                        if let SearchValueEligibility::Ineligible { reason } = eligibility {
                            move_btn.on_disabled_hover_text(format!("Search Value: {reason}"));
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
        value_def: &SearchValueDefinition,
        side_action: &mut Option<FilterPanelAction>,
    ) {
        Frame::group(ui.style())
            .fill(ui.visuals().faint_bg_color)
            .inner_margin(Margin::symmetric(8, 4))
            .show(ui, |ui| {
                ui.horizontal(|ui| {
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
                            .on_hover_text("Remove search value from session")
                            .clicked()
                        {
                            *side_action = Some(FilterPanelAction::RemoveSearchValue(value_id));
                        }
                    });
                });
            });
    }
}
