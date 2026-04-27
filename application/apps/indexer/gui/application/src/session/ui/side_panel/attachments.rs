use std::cmp::Ordering;

use itertools::Itertools;
use log::error;
use rustc_hash::FxHashSet;

use egui::{Frame, Label, Layout, Modifiers, RichText, Ui, UiBuilder, Widget, vec2};
use stypes::AttachmentInfo;
use tokio::sync::mpsc;
use uuid::Uuid;

use crate::{
    host::{
        command::{CopyFileInfo, HostCommand},
        common::{
            colors::{self, DEFAULT_ATTACHMENT_EXT_COLOR},
            file_utls,
            ui_utls::show_side_panel_group,
        },
        ui::{UiActions, actions::FileDialogOptions},
    },
    session::{
        command::SessionCommand,
        ui::{
            shared::{AttachmentsState, SessionShared},
            side_panel::TITLE_SIZE,
        },
    },
};
const ATTACHMENTS_DIALOG_ID_SAVE_SELECTED: &str = "save_selected_attachments";
const ATTACHMENTS_DIALOG_ID_SAVE_AS: &str = "save_attachment_as";

const EXT_COLUMN_WIDTH: f32 = 40.0;
const ROW_VERTICAL_PADDING: f32 = 8.0;
const ROW_HORIZONTAL_PADDING: f32 = 12.0;

const SUBTITLE_SIZE: f32 = TITLE_SIZE - 1.0;

#[derive(Debug)]
pub struct AttachmentsUi {
    host_cmd_tx: mpsc::Sender<HostCommand>,
    #[allow(unused)]
    session_cmd_tx: mpsc::Sender<SessionCommand>,
    /// Indices of currently selected rows in the attachments list.
    selected_rows: FxHashSet<usize>,
    /// Index of the previously clicked row, used as the anchor for shift-click multi-selection.
    previously_clicked_row: Option<usize>,
    /// Uuids of attachments that are pending to be saved after file dialog completion.
    pending_attachment_save: FxHashSet<Uuid>,
}

/// Deferred filter mutation collected while rendering the filter menu.
#[derive(Debug)]
enum FilterChange {
    Clear,
    Set(String),
}

impl AttachmentsUi {
    pub fn new(
        host_cmd_tx: mpsc::Sender<HostCommand>,
        session_cmd_tx: mpsc::Sender<SessionCommand>,
    ) -> Self {
        Self {
            host_cmd_tx,
            session_cmd_tx,
            selected_rows: FxHashSet::default(),
            previously_clicked_row: None,
            pending_attachment_save: FxHashSet::default(),
        }
    }

    pub fn render_content(
        &mut self,
        shared: &mut SessionShared,
        ui_actions: &mut UiActions,
        ui: &mut Ui,
    ) {
        self.handle_pending_dialogs(ui_actions, &shared.attachments);

        self.render_header(ui, &mut shared.attachments);

        // Details panel located at the bottom but needs to be rendered before the attachments list.
        if self.selected_rows.len() == 1 {
            egui::Panel::bottom("attachments_details")
                .frame(Frame::NONE)
                .resizable(false)
                .show_separator_line(false)
                .exact_size(200.0)
                .show_inside(ui, |ui| {
                    show_side_panel_group(ui, |ui| self.render_preview(ui));
                });
        }

        egui::CentralPanel::default()
            .frame(Frame::NONE)
            .show_inside(ui, |ui| {
                show_side_panel_group(ui, |ui| self.render_list(shared, ui_actions, ui));
            });
    }

    fn render_header(&mut self, ui: &mut egui::Ui, attachments: &mut AttachmentsState) {
        let mut filter_change = None;
        let active_filter = attachments.active_filter();
        let active_extension = active_filter.map(|filter| filter.extension().to_string());
        let filtered_count = active_filter.map(|filter| filter.indices().len());
        let attachments_count = attachments.attachments().len();

        egui::Sides::new().show(
            ui,
            |ui| {
                let count = filtered_count.map_or_else(
                    || attachments_count.to_string(),
                    |filtered_count| format!("{filtered_count}/{attachments_count}"),
                );
                let title = format!("Attachments ({count})");
                Label::new(RichText::new(title).heading().size(TITLE_SIZE)).ui(ui);
            },
            |ui| {
                let response = ui.menu_button(
                    egui::RichText::new(egui_phosphor::regular::FUNNEL).size(16.0),
                    |ui| {
                        ui.set_min_width(80.0);

                        let all_label = if active_extension.is_none() {
                            format!("{} All", egui_phosphor::regular::CHECK)
                        } else {
                            "  All".to_string()
                        };
                        if ui.button(all_label).clicked() {
                            filter_change = Some(FilterChange::Clear);
                            ui.close();
                        }

                        if !attachments.extensions().is_empty() {
                            ui.separator();
                        }

                        for extension in attachments.extensions() {
                            let is_active = active_extension.as_deref() == Some(extension.as_str());
                            let label = if is_active {
                                format!("{} *.{extension}", egui_phosphor::regular::CHECK)
                            } else {
                                format!("  *.{extension}")
                            };

                            if ui.button(label).clicked() {
                                if !is_active {
                                    filter_change = Some(FilterChange::Set(extension.clone()));
                                }
                                ui.close();
                            }
                        }
                    },
                );

                if let Some(extension) = active_extension.as_deref() {
                    let dot_center = response.response.rect.right_top() + egui::vec2(-0.5, 0.5);
                    ui.painter().circle_filled(
                        dot_center,
                        3.5,
                        colors::main_accent_stroke(ui.visuals().dark_mode),
                    );
                    let filtered_count = filtered_count.unwrap_or(attachments_count);
                    response.response.on_hover_text(format!(
                        "Filtered by *.{extension}: {filtered_count} of {attachments_count}"
                    ));
                }
            },
        );

        match filter_change {
            Some(FilterChange::Set(extension)) => {
                attachments.set_extension_filter(extension);
                // Narrowing/changing the visible set drops hidden selections and the shift anchor.
                self.selected_rows.clear();
                self.previously_clicked_row = None;
            }
            // Clearing expands the visible set, so existing selections remain valid.
            Some(FilterChange::Clear) => attachments.clear_filter(),
            None => {}
        }

        ui.add_space(ui.spacing().item_spacing.y);
    }

    // TODO [TOOL-741]: Implement attachments preview.
    fn render_preview(&self, ui: &mut egui::Ui) {
        Label::new(RichText::new("Preview").heading().size(SUBTITLE_SIZE))
            .truncate()
            .ui(ui);
        ui.centered_and_justified(|ui| {
            ui.label(RichText::new("Attachment preview not implemented yet."));
        });
    }

    fn render_list(
        &mut self,
        shared: &mut SessionShared,
        ui_actions: &mut UiActions,
        ui: &mut egui::Ui,
    ) {
        let attachments_count = shared.attachments.attachments().len();
        let visible_count = shared
            .attachments
            .active_filter()
            .map_or(attachments_count, |filter| filter.indices().len());
        let row_height = 2.0 * ui.text_style_height(&egui::TextStyle::Body) + ROW_VERTICAL_PADDING;

        Label::new(
            RichText::new("Received Attachments")
                .heading()
                .size(SUBTITLE_SIZE),
        )
        .truncate()
        .ui(ui);
        ui.add_space(5.0);

        if attachments_count == 0 {
            ui.label(RichText::new("No attachments").weak());
            return;
        }

        if visible_count == 0 {
            ui.label(RichText::new("No attachments match the active filter").weak());
            return;
        }

        ui.scope(|ui| {
            ui.spacing_mut().item_spacing.y = 0.0;
            egui::ScrollArea::vertical().show_rows(
                ui,
                row_height,
                visible_count,
                |ui, row_range| {
                    for visible_row in row_range {
                        // show_rows emits visible row numbers. Filtered rows map back to the
                        // full attachments list because selection and save actions use that index.
                        let attachment_idx = match shared.attachments.active_filter() {
                            Some(filter) => match filter.indices().get(visible_row).copied() {
                                Some(index) => index,
                                None => continue,
                            },
                            None => visible_row,
                        };
                        let is_selected = self.selected_rows.contains(&attachment_idx);
                        let Some(attachment) = shared.attachments.attachments().get(attachment_idx)
                        else {
                            continue;
                        };

                        let extension_color = attachment
                            .ext
                            .as_deref()
                            .and_then(|ext| shared.attachments.color_by_extension(ext))
                            .unwrap_or(DEFAULT_ATTACHMENT_EXT_COLOR);

                        let response = self.render_row(
                            ui,
                            attachment,
                            extension_color,
                            row_height,
                            is_selected,
                        );

                        if response.clicked() {
                            self.handle_row_click(
                                attachment_idx,
                                shared
                                    .attachments
                                    .active_filter()
                                    .map(|filter| filter.indices()),
                                ui.input(|i| i.modifiers),
                            );
                        }

                        response.context_menu(|ui| {
                            self.render_context_menu(attachment_idx, shared, ui_actions, ui);
                        });
                    }
                },
            );
        });
    }

    fn render_row(
        &mut self,
        ui: &mut egui::Ui,
        attachment: &AttachmentInfo,
        extension_color: egui::Color32,
        row_height: f32,
        is_selected: bool,
    ) -> egui::Response {
        let (row_rectangle, response) = ui.allocate_exact_size(
            egui::vec2(ui.available_width(), row_height),
            egui::Sense::click(),
        );

        let row_background_color = match (is_selected, response.hovered()) {
            (true, true) => ui.visuals().selection.bg_fill.gamma_multiply(0.85),
            (true, false) => ui.visuals().selection.bg_fill,
            (false, true) => ui.visuals().widgets.hovered.bg_fill,
            (false, false) => egui::Color32::TRANSPARENT,
        };
        if row_background_color != egui::Color32::TRANSPARENT {
            ui.painter()
                .rect_filled(row_rectangle, 4.0, row_background_color);
        }

        ui.painter().rect_filled(
            egui::Rect::from_min_size(row_rectangle.min, egui::vec2(4.0, row_rectangle.height())),
            0.0,
            extension_color,
        );

        let formatted_size = file_utls::format_file_size(attachment.size as u64);
        ui.scope_builder(
            UiBuilder::new()
                .max_rect(row_rectangle)
                .layout(Layout::left_to_right(egui::Align::LEFT)),
            |ui| {
                ui.add_space(ROW_HORIZONTAL_PADDING);

                ui.add_sized(
                    vec2(EXT_COLUMN_WIDTH, row_height),
                    Label::new(
                        RichText::new(attachment.ext.as_deref().unwrap_or("—").to_uppercase())
                            .strong()
                            .color(extension_color),
                    ),
                );
                ui.vertical(|ui| {
                    ui.add_space(ROW_VERTICAL_PADDING / 2.0);
                    ui.add(Label::new(RichText::new(&attachment.name)).truncate());
                    ui.add(Label::new(RichText::new(formatted_size).weak()).truncate());
                });
            },
        );

        response
    }

    fn render_context_menu(
        &mut self,
        attachment_idx: usize,
        shared: &mut SessionShared,
        ui_actions: &mut UiActions,
        ui: &mut egui::Ui,
    ) {
        let attachments = shared.attachments.attachments();
        let Some(attachment) = attachments.get(attachment_idx) else {
            return;
        };
        let attachment_count = attachments.len();

        // ** Attachments Selection **
        if ui.button("Select all").clicked() {
            self.selected_rows.clear();
            if let Some(filter) = shared.attachments.active_filter() {
                self.selected_rows.extend(filter.indices().iter().copied());
            } else {
                self.selected_rows.extend(0..attachment_count);
            }
            ui.close();
        }
        if ui.button("Invert selection").clicked() {
            let all_rows: FxHashSet<usize> =
                if let Some(filter) = shared.attachments.active_filter() {
                    filter.indices().iter().copied().collect()
                } else {
                    (0..attachment_count).collect()
                };
            self.selected_rows = all_rows.difference(&self.selected_rows).copied().collect();
            ui.close();
        }
        ui.separator();

        // ** Jump & Select matching Logs **
        if let [first_position, ..] = attachment.messages.as_slice() {
            let response = ui
                .button(RichText::new("Jump to related row"))
                .on_hover_text("Jumps to the first related row");
            if response.clicked() {
                shared.logs.focus_main_row(*first_position as u64);
                ui.close();
            }

            if ui
                .button(RichText::new("Select all related rows"))
                .clicked()
            {
                let rows = attachment
                    .messages
                    .iter()
                    .map(|&position| position as u64)
                    .collect::<Vec<_>>();
                shared.logs.focus_main_rows(&rows);
                ui.close();
            }

            ui.separator();
        }

        // ** Save Attachments **
        if ui.button(RichText::new("Save as")).clicked() {
            self.pending_attachment_save.clear();
            self.pending_attachment_save.insert(attachment.uuid);

            ui_actions.file_dialog.save_file(
                ATTACHMENTS_DIALOG_ID_SAVE_AS,
                FileDialogOptions::new()
                    .file_name(
                        attachment
                            .filepath
                            .file_name()
                            .and_then(|s| s.to_str())
                            .unwrap_or(""),
                    )
                    .title("Save attachment as..."),
            );
        }

        if ui
            .add_enabled(
                !self.selected_rows.is_empty(),
                egui::Button::new("Save selected"),
            )
            .clicked()
        {
            self.pending_attachment_save.clear();
            self.pending_attachment_save.extend(
                self.selected_rows
                    .iter()
                    .filter_map(|&r| attachments.get(r))
                    .map(|a| a.uuid),
            );

            ui_actions.file_dialog.pick_folder(
                ATTACHMENTS_DIALOG_ID_SAVE_SELECTED,
                FileDialogOptions::new().title("Save selected attachments..."),
            );

            ui.close();
        }
        if ui.button("Save all").clicked() {
            self.pending_attachment_save.clear();
            self.pending_attachment_save
                .extend(attachments.iter().map(|a| a.uuid));

            ui_actions.file_dialog.pick_folder(
                ATTACHMENTS_DIALOG_ID_SAVE_SELECTED,
                FileDialogOptions::new().title("Save all attachments..."),
            );

            ui.close();
        }
    }

    fn handle_pending_dialogs(
        &mut self,
        ui_actions: &mut UiActions,
        attachments_state: &AttachmentsState,
    ) {
        let Some((id, selected_paths)) = ui_actions.file_dialog.take_output_many(&[
            ATTACHMENTS_DIALOG_ID_SAVE_SELECTED,
            ATTACHMENTS_DIALOG_ID_SAVE_AS,
        ]) else {
            return;
        };

        let Ok(path) = selected_paths.iter().exactly_one() else {
            if !selected_paths.is_empty() {
                error!(
                    "Unexpected error: Expected exactly one path from dialog (id={id:?}), got {:?}",
                    selected_paths
                );
            }
            return;
        };

        let mut copy_file_infos: Vec<CopyFileInfo> = Vec::new();

        for &attachment_uuid in self.pending_attachment_save.iter() {
            let Some(attachment) = attachments_state.attachment_by_uuid(&attachment_uuid) else {
                error!(
                    "Unexpected error: No attachment found for uuid during handling of pending save: {attachment_uuid}"
                );
                continue;
            };

            let destination = match id {
                ATTACHMENTS_DIALOG_ID_SAVE_SELECTED => {
                    let Some(file_name) = attachment.filepath.file_name() else {
                        error!(
                            "Unexpected error: Could not determine file name for attachment: {:?}",
                            attachment.filepath
                        );
                        continue;
                    };
                    path.join(file_name)
                }
                ATTACHMENTS_DIALOG_ID_SAVE_AS => path.to_path_buf(),
                _ => {
                    error!("Unexpected error: Unknown dialog id: {id:?}");
                    continue;
                }
            };

            copy_file_infos.push(CopyFileInfo {
                source: attachment.filepath.clone(),
                destination,
            });
        }

        if !copy_file_infos.is_empty() {
            let host_command = HostCommand::CopyFiles { copy_file_infos };
            ui_actions.try_send_command(&self.host_cmd_tx, host_command);
        }
    }

    fn handle_row_click(
        &mut self,
        clicked_attachment_idx: usize,
        filtered_indices: Option<&[usize]>,
        modifiers: egui::Modifiers,
    ) {
        if modifiers.matches_exact(Modifiers::CTRL) {
            if self.selected_rows.contains(&clicked_attachment_idx) {
                self.selected_rows.remove(&clicked_attachment_idx);
            } else {
                self.selected_rows.insert(clicked_attachment_idx);
            }
        }

        if modifiers.matches_exact(Modifiers::SHIFT)
            && let Some(previously_clicked_row) = self.previously_clicked_row
        {
            self.select_shift_range(
                previously_clicked_row,
                clicked_attachment_idx,
                filtered_indices,
            );
        }

        if modifiers.matches_exact(Modifiers::NONE) {
            if self.selected_rows.len() == 1 && self.selected_rows.contains(&clicked_attachment_idx)
            {
                self.selected_rows.clear();
            } else {
                self.selected_rows.clear();
                self.selected_rows.insert(clicked_attachment_idx);
            }
        }
        self.previously_clicked_row = Some(clicked_attachment_idx);
    }

    fn select_shift_range(
        &mut self,
        previous_attachment_idx: usize,
        clicked_attachment_idx: usize,
        filtered_indices: Option<&[usize]>,
    ) {
        // Without a filter, visible row indices and attachment indices are identical.
        let Some(filtered_indices) = filtered_indices else {
            let shift_range = match previous_attachment_idx.cmp(&clicked_attachment_idx) {
                Ordering::Less => previous_attachment_idx..=clicked_attachment_idx,
                Ordering::Greater => clicked_attachment_idx..=previous_attachment_idx,
                Ordering::Equal => clicked_attachment_idx..=clicked_attachment_idx,
            };

            self.selected_rows.extend(shift_range);
            return;
        };

        // With a filter, shift selection must use visible positions to avoid selecting hidden rows.
        let Some(previous_visible_idx) = filtered_indices
            .iter()
            .position(|&index| index == previous_attachment_idx)
        else {
            return;
        };
        let Some(clicked_visible_idx) = filtered_indices
            .iter()
            .position(|&index| index == clicked_attachment_idx)
        else {
            return;
        };

        let visible_range = match previous_visible_idx.cmp(&clicked_visible_idx) {
            Ordering::Less => previous_visible_idx..=clicked_visible_idx,
            Ordering::Greater => clicked_visible_idx..=previous_visible_idx,
            Ordering::Equal => clicked_visible_idx..=clicked_visible_idx,
        };

        // Store selected rows as attachment indices so save/context actions stay filter-agnostic.
        self.selected_rows
            .extend(visible_range.map(|visible_idx| filtered_indices[visible_idx]));
    }
}
