//! Update-available banner shown over the host content area.

use egui::{
    Align, Area, Button, Frame, Grid, Id, Layout, OpenUrl, Order, Stroke, Ui, Widget, vec2,
};
use tokio::sync::mpsc;

use crate::{
    common::app_info,
    host::{
        command::HostCommand,
        common::colors,
        ui::{UiActions, state::info::AppInfoState, update::DownloadUpdateParam},
    },
};

const UPDATE_CARD_MARGIN: f32 = 16.0;
const UPDATE_CARD_MAX_WIDTH: f32 = 320.0;

/// Renders the update banner when update information is available and not dismissed.
pub fn render(
    info_state: &mut AppInfoState,
    cmd_tx: &mpsc::Sender<HostCommand>,
    ui_actions: &mut UiActions,
    ui: &mut Ui,
) {
    let Some(update) = info_state.update_info() else {
        return;
    };

    let mut dismiss = false;
    let mut open_release = false;

    let card_width = (ui.max_rect().width() - UPDATE_CARD_MARGIN * 2.0).min(UPDATE_CARD_MAX_WIDTH);

    let card_response = Area::new(Id::new("app_version_update_card"))
        .order(Order::Foreground)
        .anchor(
            egui::Align2::RIGHT_BOTTOM,
            vec2(-UPDATE_CARD_MARGIN, -UPDATE_CARD_MARGIN),
        )
        .show(ui.ctx(), |ui| {
            ui.set_width(card_width);

            let accent_stroke = colors::main_accent_stroke(ui.visuals().dark_mode);
            Frame::window(ui.style())
                .stroke(Stroke::new(1.0_f32, accent_stroke))
                .show(ui, |ui| {
                    ui.set_width(card_width);

                    ui.vertical_centered(|ui| ui.heading("Update available"));

                    ui.add_space(4.0);
                    ui.label("A newer Chipmunk version is available.");
                    if update.plan.is_none() {
                        ui.add_space(4.0);
                        ui.label("Built-in update is not available for this installation.");
                    }
                    ui.add_space(8.0);

                    Grid::new("app_version_update_versions")
                        .num_columns(2)
                        .show(ui, |ui| {
                            ui.strong("Current:");
                            ui.label(app_info::current_version().to_string());
                            ui.end_row();

                            ui.strong("Latest:");
                            ui.label(update.latest_version.to_string());
                            ui.end_row();
                        });

                    ui.add_space(8.0);
                    ui.vertical_centered(|ui| {
                        let actions_width = if update.plan.is_some() {
                            ui.available_width()
                        } else {
                            205.0
                        };
                        ui.allocate_ui_with_layout(
                            vec2(actions_width, 25.0),
                            Layout::left_to_right(Align::Center),
                            |ui| {
                                let button_size = vec2(100.0, 25.0);

                                if let Some(plan) = update.plan.as_ref()
                                    && Button::new("Download")
                                        .min_size(button_size)
                                        .ui(ui)
                                        .clicked()
                                {
                                    let params = DownloadUpdateParam {
                                        latest_version: update.latest_version.clone(),
                                        release_url: update.release_url.clone(),
                                        plan: plan.clone(),
                                    };
                                    ui_actions.try_send_command(
                                        cmd_tx,
                                        HostCommand::DownloadAppUpdate(Box::new(params)),
                                    );

                                    dismiss = true;
                                }
                                if Button::new("Open release")
                                    .min_size(button_size)
                                    .ui(ui)
                                    .clicked()
                                {
                                    open_release = true;
                                }

                                if Button::new("Dismiss")
                                    .min_size(button_size)
                                    .ui(ui)
                                    .clicked()
                                {
                                    dismiss = true;
                                }
                            },
                        );
                    });
                });
        });

    if card_response.response.clicked_elsewhere() {
        dismiss = true;
    }

    if open_release {
        ui.ctx()
            .open_url(OpenUrl::new_tab(update.release_url.clone()));
        dismiss = true;
    }

    if dismiss {
        info_state.show_update_banner = false;
    }
}
