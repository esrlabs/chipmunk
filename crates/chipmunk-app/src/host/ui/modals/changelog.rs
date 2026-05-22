//! Changelog dialog rendering.

use egui::{Align, Button, Layout, OpenUrl, ScrollArea, Ui, Widget, vec2};
use egui_commonmark::CommonMarkViewer;

use crate::{
    common::ui::modal::{ModalSize, ResponsiveModalSize, show_modal},
    host::ui::state::info::AppInfoState,
};

/// Renders the changelog dialog and returns true when it should close.
pub fn render_modal(info_state: &mut AppInfoState, parent_ui: &Ui) -> bool {
    let mut open_release_url = None;

    let Some((changelog, markdown_cache)) = info_state.changelog_parts() else {
        return true;
    };

    let title = format!("What's new in {}", changelog.version);

    let modal = show_modal(
        parent_ui,
        "app_changelog",
        ModalSize::Responsive(ResponsiveModalSize {
            width_ratio: 0.65,
            height_ratio: 0.75,
            min_size: vec2(420.0, 320.0),
            max_size: vec2(900.0, 700.0),
            window_padding: vec2(40.0, 40.0),
        }),
        |ui, size| {
            ui.heading(title);
            ui.add_space(4.0);
            ui.separator();

            let notes_height = (size.y - 95.0).max(120.0);
            ScrollArea::vertical()
                .auto_shrink([false, false])
                .max_height(notes_height)
                .show(ui, |ui| {
                    CommonMarkViewer::new().show(ui, markdown_cache, &changelog.release_notes);
                });

            ui.separator();
            ui.allocate_ui_with_layout(
                vec2(ui.available_width(), 25.0),
                Layout::right_to_left(Align::Center),
                |ui| {
                    let action_button_size = vec2(100.0, 25.0);
                    if Button::new("Close")
                        .min_size(action_button_size)
                        .ui(ui)
                        .clicked()
                    {
                        ui.close();
                    }

                    if Button::new("Open release")
                        .min_size(action_button_size)
                        .ui(ui)
                        .clicked()
                    {
                        open_release_url = Some(changelog.release_url.clone());
                    }
                },
            );
        },
    );

    if let Some(open_release_url) = open_release_url {
        parent_ui.ctx().open_url(OpenUrl::new_tab(open_release_url));
    }

    modal.should_close()
}
