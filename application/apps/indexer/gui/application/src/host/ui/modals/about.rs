//! About dialog rendering.

use egui::{Align, Button, Layout, OpenUrl, Ui, Widget, vec2};

use crate::{
    common::{
        app_info,
        ui::modal::{ModalSize, show_modal},
    },
    host::ui::state::info::AppInfoState,
};

const ABOUT_GITHUB_URL: &str = "https://github.com/esrlabs/chipmunk";
const ABOUT_REPORT_ISSUE_URL: &str = "https://github.com/esrlabs/chipmunk/issues/new/choose";
const ACTION_BUTTON_SIZE: egui::Vec2 = vec2(100.0, 25.0);

/// Renders the About dialog and returns true when it should close.
pub fn render_modal(info_state: &mut AppInfoState, parent_ui: &Ui) -> bool {
    let ctx = parent_ui.ctx();
    let current_version = app_info::current_version().to_string();

    let mut open_github = false;
    let mut open_report_issue = false;
    let mut open_release_url = None;

    let modal = show_modal(
        parent_ui,
        "about",
        ModalSize::MaxWidth(360.0),
        |ui, _size| {
            ui.vertical_centered(|ui| {
                ui.heading(app_info::TITLE);
                ui.add_space(8.0);
                ui.label("Built for fast, scalable log and trace analysis.");
                ui.add_space(8.0);
                ui.label(format!("Version: {current_version}"));

                if let Some(update_info) = info_state.update_info() {
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
        },
    );

    if let Some(open_release_url) = open_release_url {
        ctx.open_url(OpenUrl::new_tab(open_release_url));
    }

    if open_github {
        ctx.open_url(OpenUrl::new_tab(ABOUT_GITHUB_URL));
    }

    if open_report_issue {
        ctx.open_url(OpenUrl::new_tab(ABOUT_REPORT_ISSUE_URL));
    }

    modal.should_close()
}
