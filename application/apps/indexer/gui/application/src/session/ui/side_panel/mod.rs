use egui::{Align2, CentralPanel, FontId, Frame, Margin, Sense, SidePanel, Ui, vec2};
use tokio::sync::mpsc;

use crate::{
    common::phosphor::icons,
    session::{command::SessionCommand, ui::shared::SessionShared},
};

mod attachments;
mod filters;
mod observing;
mod types;

use attachments::AttachmentsUi;
use filters::FiltersUi;
use observing::ObservingUi;

pub use types::*;

#[derive(Debug)]
pub struct SidePanelUi {
    observing: ObservingUi,
    attachments: AttachmentsUi,
    filters: FiltersUi,
}

impl SidePanelUi {
    pub fn new(cmd_tx: mpsc::Sender<SessionCommand>) -> Self {
        Self {
            observing: ObservingUi::new(cmd_tx.clone()),
            attachments: AttachmentsUi::new(cmd_tx.clone()),
            filters: FiltersUi::new(cmd_tx.clone()),
        }
    }

    pub fn render_content(&mut self, shared: &mut SessionShared, ui: &mut Ui) {
        SidePanel::left("side tabs")
            .frame(
                Frame::new()
                    .inner_margin(Margin {
                        left: 4,
                        right: 0,
                        top: 4,
                        bottom: 4,
                    })
                    .fill(ui.style().visuals.widgets.active.bg_fill),
            )
            .resizable(false)
            .exact_width(36.)
            .show_separator_line(false)
            .show_inside(ui, |ui| {
                for tab in SideTabType::all() {
                    render_tab_button(*tab, &mut shared.side_tab, ui);
                    ui.add_space(3.);
                }
            });

        CentralPanel::default().show_inside(ui, |ui| match shared.side_tab {
            SideTabType::Observing => self.observing.render_content(shared, ui),
            SideTabType::Attachments => self.attachments.render_content(shared, ui),
            SideTabType::Filters => self.filters.render_content(shared, ui),
        });
    }
}

fn render_tab_button(target: SideTabType, current_tab: &mut SideTabType, ui: &mut Ui) {
    let icon = match target {
        SideTabType::Observing => icons::regular::BROADCAST,
        SideTabType::Attachments => icons::regular::PAPERCLIP,
        SideTabType::Filters => icons::regular::FUNNEL,
    };

    let (rect, mut res) = ui.allocate_exact_size(vec2(33., 40.), Sense::click());

    let selected = target == *current_tab;
    let corner_radius = 2;
    let fg = if selected {
        ui.painter()
            .rect_filled(rect, corner_radius, ui.visuals().panel_fill);

        ui.visuals().widgets.active.fg_stroke.color
    } else if res.hovered() {
        ui.painter()
            .rect_filled(rect, corner_radius, ui.visuals().widgets.hovered.bg_fill);

        ui.visuals().widgets.active.fg_stroke.color
    } else {
        ui.visuals().widgets.inactive.fg_stroke.color
    };

    ui.painter().text(
        rect.center(),
        Align2::CENTER_CENTER,
        icon,
        FontId::proportional(24.),
        fg,
    );

    res = res.on_hover_ui(|ui| {
        ui.set_max_width(ui.spacing().tooltip_width);
        ui.label(target.to_string());
    });

    if res.clicked() {
        *current_tab = target;
    }
}
