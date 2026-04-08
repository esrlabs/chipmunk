//! Favorite-folders UI for the home screen.
//!
//! This module renders the home-screen file explorer, manages its transient UI
//! state, and bridges user actions to the host/storage layers.

use std::mem::take;

use egui::{Align, Button, CollapsingHeader, Layout, RichText, Ui};
use tokio::sync::mpsc::Sender;

use crate::common::phosphor::icons;
use crate::host::{
    command::{HostCommand, ScanFavoriteFoldersParam},
    ui::{
        UiActions,
        actions::FileDialogOptions,
        storage::{FavoriteFoldersScanRequest, FileExplorerStorage, LoadState},
    },
};

const FAVORITES_FOLDER_ID: &str = "favorites_folder";

#[derive(Debug)]
pub struct FileExplorerUi {
    favorite_search: String,
    favorite_collapse: bool,
    cmd_tx: Sender<HostCommand>,
}

impl FileExplorerUi {
    /// Creates the home-screen file-explorer UI controller.
    pub fn new(cmd_tx: Sender<HostCommand>) -> Self {
        Self {
            favorite_search: String::new(),
            favorite_collapse: false,
            cmd_tx,
        }
    }

    /// Renders the favorite-folders panel and applies user actions to the
    /// file-explorer storage domain.
    pub fn render_content(
        &mut self,
        actions: &mut UiActions,
        file_explorer: &mut FileExplorerStorage,
        ui: &mut Ui,
    ) {
        let busy_label = favorite_folders_busy_label(file_explorer);
        let busy = busy_label.is_some();
        let search_filter = self.favorite_search.to_lowercase();
        let has_search_filter = !search_filter.is_empty();

        ui.add_space(5.0);
        ui.heading("Favorite folders");

        if let Some(paths) = actions.file_dialog.take_output(FAVORITES_FOLDER_ID) {
            let paths = paths
                .into_iter()
                .filter(|path| !file_explorer.contains_favorite_folder(path))
                .collect();

            if let Some(request) = file_explorer.prepare_add_scan(paths) {
                self.send_favorite_folder_scan(actions, file_explorer, request);
            }
        }

        ui.horizontal(|ui| {
            ui.with_layout(Layout::left_to_right(Align::Center), |ui| {
                ui.label("Search:");

                ui.with_layout(Layout::right_to_left(Align::Center), |ui| {
                    if ui
                        .add_enabled(
                            !busy,
                            Button::new(RichText::new(icons::regular::PLUS).size(12.0)).small(),
                        )
                        .on_hover_text("Add folder")
                        .clicked()
                    {
                        actions.file_dialog.pick_folder(
                            FAVORITES_FOLDER_ID,
                            FileDialogOptions::new().title("Select Favorites Folder"),
                        );
                    }

                    if ui
                        .add_enabled(
                            !busy,
                            Button::new(RichText::new(icons::regular::ARROWS_CLOCKWISE).size(12.0))
                                .small(),
                        )
                        .on_hover_text("Refresh")
                        .clicked()
                    {
                        let paths = match &file_explorer.state {
                            LoadState::Ready(data) => data
                                .favorite_folders
                                .iter()
                                .map(|folder| folder.path.clone())
                                .collect(),
                            LoadState::Loading => Vec::new(),
                        };

                        if let Some(request) = file_explorer.prepare_scan(paths) {
                            self.send_favorite_folder_scan(actions, file_explorer, request);
                        }
                    }

                    let search_response = ui.add_enabled(
                        !busy,
                        egui::TextEdit::singleline(&mut self.favorite_search)
                            .desired_width(f32::INFINITY)
                            .hint_text("type to filter..."),
                    );

                    if search_response.changed() && self.favorite_search.is_empty() {
                        self.favorite_collapse = true;
                    }
                });
            });
        });

        ui.add_space(2.0);

        if let Some(label) = busy_label
            && matches!(file_explorer.state, LoadState::Ready(_))
        {
            ui.horizontal(|ui| {
                ui.spinner();
                ui.label(label);
            });
            ui.add_space(6.0);
        }

        egui::ScrollArea::vertical()
            .id_salt("favorite_folders_scroll")
            .show(ui, |ui| {
                let LoadState::Ready(data) = &file_explorer.state else {
                    ui.vertical_centered(|ui| {
                        ui.add_space(12.0);
                        ui.spinner();
                        ui.add_space(8.0);
                        ui.label("Loading favorite folders...");
                    });
                    return;
                };

                let expand = if take(&mut self.favorite_collapse) {
                    Some(false)
                } else if has_search_filter {
                    Some(true)
                } else {
                    None
                };

                let mut remove_path = None;

                for folder in &data.favorite_folders {
                    CollapsingHeader::new(folder.path.display().to_string())
                        .id_salt(folder.path.to_string_lossy())
                        .open(expand)
                        .show(ui, |ui| {
                            if !has_search_filter
                                && ui
                                    .add_enabled(
                                        !busy,
                                        Button::new(
                                            RichText::new(icons::regular::TRASH).size(12.0),
                                        )
                                        .small(),
                                    )
                                    .on_hover_text("Remove folder")
                                    .clicked()
                            {
                                remove_path = Some(folder.path.clone());
                            }

                            for file in &folder.files {
                                if has_search_filter
                                    && !file.name.to_lowercase().contains(&search_filter)
                                {
                                    continue;
                                }

                                ui.horizontal(|ui| {
                                    if ui
                                        .add_enabled(
                                            !busy,
                                            Button::new(
                                                RichText::new(icons::regular::ARROW_SQUARE_OUT)
                                                    .size(12.0),
                                            )
                                            .small(),
                                        )
                                        .on_hover_text(format!("Open file ({})", file.size_txt))
                                        .clicked()
                                    {
                                        let cmd = HostCommand::OpenFiles(vec![
                                            folder.path.join(&file.name),
                                        ]);
                                        actions.try_send_command(&self.cmd_tx, cmd);
                                    }
                                    ui.label(&file.name);
                                });
                            }
                        });
                }

                if let Some(path) = remove_path {
                    file_explorer.remove_favorite_folder(&path);
                }
            });
    }

    /// Sends one favorite-folder scan request to the host service and clears
    /// the pending UI-side request if the command cannot be queued.
    fn send_favorite_folder_scan(
        &self,
        actions: &mut UiActions,
        file_explorer: &mut FileExplorerStorage,
        request: FavoriteFoldersScanRequest,
    ) {
        let cmd = HostCommand::ScanFavoriteFolders(Box::new(ScanFavoriteFoldersParam {
            request_id: request.request_id,
            paths: request.paths,
        }));

        if !actions.try_send_command(&self.cmd_tx, cmd) {
            file_explorer.clear_active_scan_request();
        }
    }
}

/// Returns the current user-facing busy label for the favorite-folders panel.
fn favorite_folders_busy_label(file_explorer: &FileExplorerStorage) -> Option<&'static str> {
    if matches!(file_explorer.state, LoadState::Loading) {
        Some("Loading favorite folders")
    } else if file_explorer.active_scan_request_id.is_some() {
        Some("Scanning favorite folders")
    } else {
        None
    }
}
