//! Favorite-folders UI for the home screen.
//!
//! This module renders the home-screen file explorer, manages its transient UI
//! state, and bridges user actions to the host/storage layers.

use std::path::Path;

use egui::{Align, Layout, TextStyle};
use egui::{
    Button, Label, Response, RichText, Sense, Ui, UiBuilder, Widget,
    collapsing_header::CollapsingState, vec2,
};
use tokio::sync::mpsc::Sender;

use crate::common::phosphor::icons;
use crate::host::common::ui_utls::{sized_singleline_text_edit, truncate_path_to_width};
use crate::host::{
    command::{HostCommand, ScanFavoriteFoldersParam},
    ui::{
        UiActions,
        actions::FileDialogOptions,
        storage::{FavoriteFoldersScanRequest, FileExplorerStorage, FileUiInfo, LoadState},
    },
};

const FAVORITES_FOLDER_ID: &str = "favorites_folder";

#[derive(Debug)]
pub struct FileExplorerUi {
    favorite_search: String,
    cmd_tx: Sender<HostCommand>,
}

impl FileExplorerUi {
    /// Creates the home-screen file-explorer UI controller.
    pub fn new(cmd_tx: Sender<HostCommand>) -> Self {
        Self {
            favorite_search: String::new(),
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
        Label::new(RichText::new("Favorite folders").heading())
            .truncate()
            .ui(ui);

        if let Some(paths) = actions.file_dialog.take_output(FAVORITES_FOLDER_ID) {
            let paths = paths
                .into_iter()
                .filter(|path| !file_explorer.contains_favorite_folder(path))
                .collect();

            if let Some(request) = file_explorer.prepare_add_scan(paths) {
                self.send_favorite_folder_scan(actions, file_explorer, request);
            }
        }

        ui.allocate_ui_with_layout(
            vec2(ui.available_width(), 20.),
            Layout::right_to_left(Align::Center),
            |ui| {
                let icon_size = 15.0;

                ui.style_mut().spacing.item_spacing.x = 2.0;

                if ui
                    .add_enabled(
                        !busy,
                        Button::new(RichText::new(icons::regular::FOLDER_PLUS).size(icon_size))
                            .frame(true)
                            .frame_when_inactive(false),
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
                        Button::new(
                            RichText::new(icons::regular::ARROWS_CLOCKWISE).size(icon_size),
                        )
                        .frame(true)
                        .frame_when_inactive(false),
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

                ui.with_layout(Layout::left_to_right(Align::Center), |ui| {
                    let txt_input = sized_singleline_text_edit(
                        ui,
                        &mut self.favorite_search,
                        ui.available_size(),
                        3,
                    )
                    .hint_text("Type to filter...");

                    ui.add_enabled(!busy, txt_input);
                });
            },
        );

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

                let expand = if has_search_filter { Some(true) } else { None };

                let mut remove_path = None;

                for folder in &data.favorite_folders {
                    let folder_id = ui.make_persistent_id(("favorite_folder", &folder.path));
                    let mut folder_state =
                        CollapsingState::load_with_default_open(ui.ctx(), folder_id, false);

                    if let Some(open) = expand {
                        folder_state.set_open(open);
                    }

                    let (rect, mut header_response) = ui.allocate_exact_size(
                        vec2(ui.available_width(), ui.spacing().interact_size.y),
                        Sense::click(),
                    );

                    if header_response.clicked() {
                        folder_state.toggle(ui);
                        header_response.mark_changed();
                    }

                    let visuals = ui.style().interact_selectable(&header_response, false);
                    let text_color = visuals.text_color();
                    let icon = if folder_state.is_open() {
                        icons::regular::CARET_DOWN
                    } else {
                        icons::regular::CARET_RIGHT
                    };

                    ui.scope_builder(
                        UiBuilder::new()
                            .max_rect(rect.shrink2(ui.spacing().button_padding))
                            .layout(Layout::left_to_right(Align::Center)),
                        |ui| {
                            ui.style_mut().spacing.item_spacing.x = 4.0;
                            ui.label(RichText::new(icon).size(14.0).color(text_color));
                            let folder_label = truncate_path_to_width(
                                ui,
                                &folder.path,
                                ui.available_width(),
                                TextStyle::Body,
                            );
                            let response =
                                Label::new(RichText::new(&folder_label.text).color(text_color))
                                    .truncate()
                                    .show_tooltip_when_elided(false)
                                    .ui(ui);
                            if folder_label.truncated {
                                response.on_hover_ui(|ui| {
                                    ui.set_max_width(ui.spacing().tooltip_width);
                                    ui.label(folder.path.to_string_lossy());
                                });
                            }
                        },
                    );

                    header_response.context_menu(|ui| {
                        if ui
                            .add_enabled(!busy, Button::new("Remove from favorite folders"))
                            .clicked()
                        {
                            remove_path = Some(folder.path.clone());
                            ui.close();
                        }
                    });

                    folder_state.show_body_indented(&header_response, ui, |ui| {
                        for file in &folder.files {
                            if has_search_filter
                                && !file.name.to_lowercase().contains(&search_filter)
                            {
                                continue;
                            }

                            self.render_file_entry(ui, actions, &folder.path, file, busy);
                        }
                    });
                }

                if let Some(path) = remove_path {
                    file_explorer.remove_favorite_folder(&path);
                }
            });
    }

    fn render_file_entry(
        &self,
        ui: &mut Ui,
        actions: &mut UiActions,
        folder_path: &Path,
        file: &FileUiInfo,
        busy: bool,
    ) -> Response {
        const ROW_HEIGHT: f32 = 24.0;
        const HORIZONTAL_PADDING: f32 = 8.0;
        const VERTICAL_PADDING: f32 = 4.0;

        let sense = if busy { Sense::hover() } else { Sense::click() };
        let (rect, mut response) =
            ui.allocate_exact_size(vec2(ui.available_width(), ROW_HEIGHT), sense);

        if response.hovered() || response.is_pointer_button_down_on() {
            ui.painter()
                .rect_filled(rect, 0.0, ui.visuals().widgets.hovered.bg_fill);
        }

        let inner_rect = rect.shrink2(vec2(HORIZONTAL_PADDING, VERTICAL_PADDING));
        ui.scope_builder(UiBuilder::new().max_rect(inner_rect), |ui| {
            Label::new(file.name.as_str()).truncate().ui(ui);
        });

        response = if busy {
            response.on_hover_text(&file.name)
        } else {
            response
                .on_hover_cursor(egui::CursorIcon::PointingHand)
                .on_hover_text(&file.name)
        };

        response.context_menu(|ui| {
            if ui.add_enabled(!busy, Button::new("Open File")).clicked() {
                self.open_favorite_file(actions, folder_path.join(&file.name));
                ui.close();
            }
        });

        if !busy && response.double_clicked() {
            self.open_favorite_file(actions, folder_path.join(&file.name));
        }

        response
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

    fn open_favorite_file(&self, actions: &mut UiActions, path: std::path::PathBuf) {
        actions.try_send_command(&self.cmd_tx, HostCommand::OpenFiles(vec![path]));
    }
}

fn favorite_folders_busy_label(file_explorer: &FileExplorerStorage) -> Option<&'static str> {
    if matches!(file_explorer.state, LoadState::Loading) {
        Some("Loading favorite folders")
    } else if file_explorer.active_scan_request_id.is_some() {
        Some("Scanning favorite folders")
    } else {
        None
    }
}
