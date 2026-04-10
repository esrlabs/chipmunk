use egui::{
    Align2, CentralPanel, Color32, CornerRadius, FontId, Frame, Margin, Panel, Sense, Ui, vec2,
};
use enum_iterator::all;
use tokio::sync::mpsc;

use crate::{
    common::phosphor::icons,
    host::{
        command::HostCommand,
        common::colors,
        ui::{UiActions, registry::HostRegistry},
    },
    session::{command::SessionCommand, types::ObserveOperation, ui::shared::SessionShared},
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
    pub fn new(
        observe_op: &ObserveOperation,
        host_command_tx: mpsc::Sender<HostCommand>,
        session_cmd_tx: mpsc::Sender<SessionCommand>,
    ) -> Self {
        Self {
            observing: ObservingUi::new(observe_op, session_cmd_tx.clone()),
            attachments: AttachmentsUi::new(host_command_tx.clone(), session_cmd_tx.clone()),
            filters: FiltersUi::new(session_cmd_tx),
        }
    }

    pub fn render_content(
        &mut self,
        ui: &mut Ui,
        shared: &mut SessionShared,
        actions: &mut UiActions,
        registry: &mut HostRegistry,
    ) {
        const SIDE_TAB_RAIL_WIDTH: f32 = 40.0;
        const SIDE_TAB_SPACING: f32 = 3.0;

        Panel::left("side tabs")
            .frame(
                Frame::new()
                    .inner_margin(Margin {
                        left: 4,
                        right: 0,
                        top: 4,
                        bottom: 4,
                    })
                    .fill(colors::main_accent_background(ui.visuals().dark_mode)),
            )
            .resizable(false)
            .exact_size(SIDE_TAB_RAIL_WIDTH)
            .show_separator_line(false)
            .show_inside(ui, |ui| {
                for tab in all::<SideTabType>() {
                    render_tab_button(tab, &mut shared.side_tab, ui);
                    ui.add_space(SIDE_TAB_SPACING);
                }
            });

        CentralPanel::default().show_inside(ui, |ui| match shared.side_tab {
            SideTabType::Observing => self.observing.render_content(shared, actions, ui),
            SideTabType::Attachments => self.attachments.render_content(shared, actions, ui),
            SideTabType::Filters => {
                self.filters
                    .render_content(shared, actions, &mut registry.filters, ui)
            }
        });
    }
}

fn render_tab_button(target: SideTabType, current_tab: &mut SideTabType, ui: &mut Ui) {
    const SIDE_TAB_HEIGHT: f32 = 40.0;
    const SIDE_TAB_ICON_SIZE: f32 = 24.0;
    const SIDE_TAB_CORNER_RADIUS: u8 = 4;
    const SIDE_TAB_SELECTED_ACCENT_WIDTH: f32 = 3.0;

    // Resolve tab metadata.
    let icon = match target {
        SideTabType::Observing => icons::regular::BROADCAST,
        SideTabType::Attachments => icons::regular::PAPERCLIP,
        SideTabType::Filters => icons::regular::FUNNEL,
    };

    // Allocate interaction and tooltip.
    let selected = target == *current_tab;
    let dark_mode = ui.visuals().dark_mode;
    let accent_bg = colors::main_accent_background(dark_mode);
    let accent_stroke = colors::main_accent_stroke(dark_mode);
    let desired_size = vec2(ui.available_width(), SIDE_TAB_HEIGHT);
    let (rect, response) = ui.allocate_exact_size(desired_size, Sense::click());
    let response = response.on_hover_ui(|ui| {
        ui.set_max_width(ui.spacing().tooltip_width);
        ui.label(target.to_string());
    });

    // Derive tab visuals from the current interaction state.
    let tab_corner_radius = CornerRadius {
        nw: SIDE_TAB_CORNER_RADIUS,
        ne: 0,
        sw: SIDE_TAB_CORNER_RADIUS,
        se: 0,
    };

    let bg_fill = if selected {
        ui.visuals().panel_fill
    } else if response.is_pointer_button_down_on() {
        if dark_mode {
            accent_bg.gamma_multiply(1.18)
        } else {
            accent_bg.gamma_multiply(0.9)
        }
    } else if response.hovered() {
        if dark_mode {
            accent_bg.gamma_multiply(1.08)
        } else {
            accent_bg.gamma_multiply(0.96)
        }
    } else {
        Color32::TRANSPARENT
    };

    let fg = if selected || response.hovered() || response.has_focus() {
        accent_stroke
    } else {
        ui.visuals().widgets.inactive.fg_stroke.color
    };

    // Paint the tab body, active accent, and icon.
    if ui.is_rect_visible(rect) {
        if bg_fill != Color32::TRANSPARENT {
            ui.painter().rect_filled(rect, tab_corner_radius, bg_fill);
        }

        if selected {
            let accent_rect = rect.with_max_x(rect.min.x + SIDE_TAB_SELECTED_ACCENT_WIDTH);
            ui.painter().rect_filled(
                accent_rect,
                CornerRadius {
                    nw: SIDE_TAB_CORNER_RADIUS,
                    ne: 0,
                    sw: SIDE_TAB_CORNER_RADIUS,
                    se: 0,
                },
                accent_stroke,
            );
        }

        ui.painter().text(
            rect.center(),
            Align2::CENTER_CENTER,
            icon,
            FontId::proportional(SIDE_TAB_ICON_SIZE),
            fg,
        );
    }

    // Commit selection on click.
    if response.clicked() {
        *current_tab = target;
    }
}
