use egui::{Align, Layout, RichText, ScrollArea, Ui};

use crate::{
    common::phosphor::icons,
    common::search_value_validation::SearchValueEligibility,
    host::ui::{
        UiActions,
        registry::filters::{FilterDefinition, FilterRegistry},
    },
    session::{
        command::SessionCommand,
        ui::shared::{SearchSyncTarget, SessionShared},
    },
};

use tokio::sync::mpsc::Sender;

#[derive(Debug)]
pub struct PresetsUI {
    cmd_tx: Sender<SessionCommand>,
}

impl PresetsUI {
    pub fn new(cmd_tx: Sender<SessionCommand>) -> Self {
        Self { cmd_tx }
    }

    pub fn render_content(
        &mut self,
        shared: &mut SessionShared,
        actions: &mut UiActions,
        registry: &mut FilterRegistry,
        ui: &mut Ui,
    ) {
        // TODO AAZ: Basic implementation for now.
        self.render_filters_section(shared, actions, registry, ui);
        ui.separator();
        self.render_search_values_section(shared, actions, registry, ui);
    }

    fn render_filters_section(
        &mut self,
        shared: &mut SessionShared,
        actions: &mut UiActions,
        registry: &mut FilterRegistry,
        ui: &mut Ui,
    ) {
        ui.vertical(|ui| {
            ui.heading("Global Filter Library");
            ui.add_space(5.0);

            if registry.filters_map().is_empty() {
                ui.label(RichText::new("No filters in library").weak());
                return;
            }

            ScrollArea::vertical()
                .id_salt("presets_filters")
                .auto_shrink(true)
                .show(ui, |ui| {
                    let mut to_delete = None;

                    let session_id = shared.get_id();
                    let filters: Vec<_> = registry
                        .filters_map()
                        .iter()
                        .map(|(id, def): (&uuid::Uuid, &FilterDefinition)| {
                            (
                                *id,
                                def.filter.value.to_owned(),
                                def.search_value_eligibility.clone(),
                            )
                        })
                        .collect();

                    for (id, filter_txt, eligibility) in filters {
                        ui.horizontal(|ui| {
                            let is_applied = shared.filters.is_filter_applied(&id);

                            if ui.selectable_label(is_applied, filter_txt).clicked() {
                                if is_applied {
                                    shared.filters.unapply_filter(registry, &id);
                                } else {
                                    shared.filters.apply_filter(registry, id);
                                }

                                shared
                                    .sync_search_pipelines(registry, SearchSyncTarget::Filter)
                                    .into_iter()
                                    .for_each(|cmd| {
                                        _ = actions.try_send_command(&self.cmd_tx, cmd)
                                    });
                            }

                            ui.with_layout(Layout::right_to_left(Align::Center), |ui| {
                                let eligibility_btn = match &eligibility {
                                    SearchValueEligibility::Eligible => ui
                                        .label(RichText::new(icons::regular::CHECK).size(12.0))
                                        .on_hover_text("Eligible to convert into search value."),
                                    SearchValueEligibility::Ineligible { reason } => ui
                                        .label(RichText::new(icons::regular::X).size(12.0))
                                        .on_hover_text(reason),
                                };
                                eligibility_btn.on_hover_cursor(egui::CursorIcon::Help);

                                let can_remove = registry.can_remove_filter(&id, &session_id);
                                ui.add_enabled_ui(can_remove, |ui| {
                                    let btn =
                                        ui.button(RichText::new(icons::regular::TRASH).size(12.0));

                                    let btn = if !can_remove {
                                        let other_count = registry.filter_usage_count(&id)
                                            - if is_applied { 1 } else { 0 };
                                        btn.on_disabled_hover_text(format!(
                                            "Cannot delete: currently used in {} other session(s).",
                                            other_count
                                        ))
                                    } else {
                                        btn.on_hover_text("Delete from library")
                                    };

                                    if btn.clicked() {
                                        to_delete = Some(id);
                                    }
                                });
                            });
                        });
                    }

                    if let Some(id) = to_delete {
                        let was_applied = shared.filters.is_filter_applied(&id);
                        registry.remove_filter(&id);
                        shared.filters.unapply_filter(registry, &id);

                        if was_applied {
                            shared
                                .sync_search_pipelines(registry, SearchSyncTarget::Filter)
                                .into_iter()
                                .for_each(|cmd| _ = actions.try_send_command(&self.cmd_tx, cmd));
                        }
                    }
                });
        });
    }

    fn render_search_values_section(
        &mut self,
        shared: &mut SessionShared,
        actions: &mut UiActions,
        registry: &mut FilterRegistry,
        ui: &mut Ui,
    ) {
        ui.vertical(|ui| {
            ui.heading("Global Search Values Library");
            ui.add_space(5.0);

            if registry.search_value_map().is_empty() {
                ui.label(RichText::new("No search values in library").weak());
                return;
            }

            ScrollArea::vertical()
                .id_salt("presets_search_values")
                .auto_shrink(true)
                .show(ui, |ui| {
                    let mut to_delete = None;
                    let session_id = shared.get_id();
                    let values: Vec<_> = registry
                        .search_value_map()
                        .iter()
                        .map(
                            |(id, def): (
                                &uuid::Uuid,
                                &crate::host::ui::registry::filters::SearchValueDefinition,
                            )| (*id, def.clone()),
                        )
                        .collect();

                    for (id, search_value_def) in values {
                        ui.horizontal(|ui| {
                            let is_applied = shared.filters.is_search_value_applied(&id);

                            if ui
                                .selectable_label(is_applied, &search_value_def.filter.value)
                                .clicked()
                            {
                                if is_applied {
                                    shared.filters.unapply_search_value(registry, &id);
                                } else {
                                    shared.filters.apply_search_value(registry, id);
                                }
                                shared
                                    .sync_search_pipelines(registry, SearchSyncTarget::SearchValue)
                                    .into_iter()
                                    .for_each(|cmd| {
                                        _ = actions.try_send_command(&self.cmd_tx, cmd)
                                    });
                            }

                            ui.with_layout(Layout::right_to_left(Align::Center), |ui| {
                                let can_remove = registry.can_remove_search_value(&id, &session_id);
                                ui.add_enabled_ui(can_remove, |ui| {
                                    let btn =
                                        ui.button(RichText::new(icons::regular::TRASH).size(12.0));

                                    let btn = if !can_remove {
                                        let other_count = registry.search_value_usage_count(&id)
                                            - if is_applied { 1 } else { 0 };
                                        btn.on_disabled_hover_text(format!(
                                            "Cannot delete: currently used in {} other session(s).",
                                            other_count
                                        ))
                                    } else {
                                        btn.on_hover_text("Delete from library")
                                    };

                                    if btn.clicked() {
                                        to_delete = Some(id);
                                    }
                                });
                            });
                        });
                    }

                    if let Some(id) = to_delete {
                        let was_applied = shared.filters.is_search_value_applied(&id);
                        registry.remove_search_value(&id);
                        shared.filters.unapply_search_value(registry, &id);
                        if was_applied {
                            shared
                                .sync_search_pipelines(registry, SearchSyncTarget::SearchValue)
                                .into_iter()
                                .for_each(|cmd| _ = actions.try_send_command(&self.cmd_tx, cmd));
                        }
                    }
                });
        });
    }
}
