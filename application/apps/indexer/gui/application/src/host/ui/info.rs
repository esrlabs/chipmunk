use egui::{
    Align, Area, Button, Context, Frame, Grid, Id, Layout, OpenUrl, Order, Stroke, Ui, Widget, vec2,
};

use crate::{
    common::{app_version, modal::show_modal},
    host::{common::colors, ui::state::info::AppInfoState},
};

const UPDATE_CARD_MARGIN: f32 = 16.0;
const UPDATE_CARD_MAX_WIDTH: f32 = 250.0;
const ABOUT_GITHUB_URL: &str = "https://github.com/esrlabs/chipmunk";
const ABOUT_REPORT_ISSUE_URL: &str = "https://github.com/esrlabs/chipmunk/issues/new/choose";
const ACTION_BUTTON_SIZE: egui::Vec2 = vec2(100.0, 25.0);

pub fn render_update_banner(app_info: &mut AppInfoState, ui: &mut Ui) {
    let Some(update) = app_info.update_info() else {
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
                .stroke(Stroke::new(1.0, accent_stroke))
                .show(ui, |ui| {
                    ui.set_width(card_width);

                    ui.vertical_centered(|ui| ui.heading("Update available"));

                    ui.add_space(4.0);
                    ui.label("A newer Chipmunk version is available.");
                    ui.add_space(8.0);

                    Grid::new("app_version_update_versions")
                        .num_columns(2)
                        .show(ui, |ui| {
                            ui.strong("Current:");
                            ui.label(app_version::current_version().to_string());
                            ui.end_row();

                            ui.strong("Latest:");
                            ui.label(update.latest_version.to_string());
                            ui.end_row();
                        });

                    ui.add_space(8.0);
                    ui.vertical_centered(|ui| {
                        ui.allocate_ui_with_layout(
                            vec2(205.0, 25.0),
                            Layout::left_to_right(Align::Center),
                            |ui| {
                                let button_size = vec2(100.0, 25.0);
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
        app_info.show_update_banner = false;
    }
}

pub fn render_about_modal(app_info: &mut AppInfoState, ctx: &Context) {
    let current_version = app_version::current_version().to_string();

    let mut open_github = false;
    let mut open_report_issue = false;
    let mut open_release_url = None;

    let modal = show_modal(ctx, "about", 360.0, |ui| {
        ui.vertical_centered(|ui| {
            ui.heading("Chipmunk");
            ui.add_space(8.0);
            ui.label("Built for fast, scalable log and trace analysis.");
            ui.add_space(8.0);
            ui.label(format!("Version: {current_version}"));

            if let Some(update_info) = app_info.update_info() {
                ui.add_space(4.0);
                if ui
                    .hyperlink_to(
                        format!("Update available: {}", update_info.latest_version),
                        &update_info.release_url,
                    )
                    .clicked()
                {
                    open_release_url = Some(update_info.release_url.clone());
                }
            }

            ui.add_space(12.0);
            ui.vertical_centered(|ui| {
                ui.allocate_ui_with_layout(
                    vec2(310.0, 25.0),
                    Layout::left_to_right(Align::Center),
                    |ui| {
                        if Button::new("GitHub Repo")
                            .min_size(ACTION_BUTTON_SIZE)
                            .ui(ui)
                            .clicked()
                        {
                            open_github = true;
                        }

                        if Button::new("Report issue")
                            .min_size(ACTION_BUTTON_SIZE)
                            .ui(ui)
                            .clicked()
                        {
                            open_report_issue = true;
                        }

                        if Button::new("Close")
                            .min_size(ACTION_BUTTON_SIZE)
                            .ui(ui)
                            .clicked()
                        {
                            ui.close();
                        }
                    },
                );
            });
        });
    });

    if let Some(open_release_url) = open_release_url {
        ctx.open_url(OpenUrl::new_tab(open_release_url));
    }

    if open_github {
        ctx.open_url(OpenUrl::new_tab(ABOUT_GITHUB_URL));
    }

    if open_report_issue {
        ctx.open_url(OpenUrl::new_tab(ABOUT_REPORT_ISSUE_URL));
    }

    if modal.should_close() {
        app_info.about_open = false;
    }
}
