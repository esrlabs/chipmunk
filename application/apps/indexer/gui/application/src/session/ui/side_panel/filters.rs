use egui::{Align, Frame, Layout, Margin, RichText, ScrollArea, Ui, vec2};
use tokio::sync::mpsc;

use crate::{
    common::phosphor::icons,
    host::ui::{
        UiActions,
        registry::filters::{FilterDefinition, FilterRegistry},
    },
    session::{command::SessionCommand, ui::shared::SessionShared},
};

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

            if shared.filters.applied_filters.is_empty() {
                ui.centered_and_justified(|ui| {
                    ui.label(RichText::new("No filters applied").weak());
                });
                return;
            }

            ScrollArea::vertical().show(ui, |ui| {
                let mut to_remove = None;

                for (idx, filter_id) in shared.filters.applied_filters.iter().enumerate() {
                    let Some(filter_def) = registry.get_filter(filter_id) else {
                        continue;
                    };

                    self.render_filter_item(ui, filter_def, &mut to_remove, idx);
                }

                if let Some(idx) = to_remove {
                    let filter_id = shared.filters.applied_filters[idx];
                    shared.filters.unapply_filter(registry, &filter_id);

                    // Re-apply filters
                    let cmd = shared.apply_search_filters(registry);
                    actions.try_send_command(&self.cmd_tx, cmd);
                }
            });
        });
    }

    fn render_filter_item(
        &self,
        ui: &mut Ui,
        filter_def: &FilterDefinition,
        to_remove: &mut Option<usize>,
        idx: usize,
    ) {
        Frame::group(ui.style())
            .fill(ui.visuals().faint_bg_color)
            .inner_margin(Margin::symmetric(8, 4))
            .show(ui, |ui| {
                ui.horizontal(|ui| {
                    // Color indicator
                    let (res, painter) =
                        ui.allocate_painter(vec2(10.0, 20.0), egui::Sense::hover());
                    painter.rect_filled(res.rect, 2.0, filter_def.colors.bg);

                    ui.label(&filter_def.filter.value);

                    ui.with_layout(Layout::right_to_left(Align::Center), |ui| {
                        if ui
                            .button(RichText::new(icons::regular::TRASH).size(14.0))
                            .on_hover_text("Remove filter from session")
                            .clicked()
                        {
                            *to_remove = Some(idx);
                        }
                    });
                });
            });
    }
}
