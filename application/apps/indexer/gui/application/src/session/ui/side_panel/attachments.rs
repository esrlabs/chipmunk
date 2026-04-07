use std::cmp::Ordering;

use itertools::Itertools;
use log::error;
use rustc_hash::FxHashSet;

use egui::{Modifiers, RichText, Ui};
use stypes::AttachmentInfo;
use tokio::sync::mpsc;
use uuid::Uuid;

use crate::{
    host::{
        command::{CopyFileInfo, HostCommand},
        common::{colors::DEFAULT_ATTACHMENT_EXT_COLOR, file_utls},
        ui::{UiActions, actions::FileDialogOptions},
    },
    session::{
        command::SessionCommand,
        ui::shared::{AttachmentsState, SessionShared},
    },
};
const ATTACHMENTS_DIALOG_ID_SAVE_SELECTED: &str = "save_selected_attachments";
const ATTACHMENTS_DIALOG_ID_SAVE_AS: &str = "save_attachment_as";

const ATTACHMENTS_LIST_MINIMUM_HEIGHT: f32 = 200.0;
const ATTACHMENTS_PREVIEW_MINIMUM_HEIGHT: f32 = 100.0;
const EXT_COLUMN_WIDTH: f32 = 40.0;
const ROW_VERTICAL_PADDING: f32 = 8.0;
const ROW_HORIZONTAL_PADDING: f32 = 12.0;

#[derive(Debug)]
pub struct AttachmentsUi {
    host_cmd_tx: mpsc::Sender<HostCommand>,
    #[allow(unused)]
    session_cmd_tx: mpsc::Sender<SessionCommand>,
    /// Indices of currently selected rows in the attachments list.
    selected_rows: FxHashSet<usize>,
    /// Index of the clicked row, used for context menu actions.
    clicked_row: Option<usize>,
    /// Index of the previously clicked row, used as the anchor for shift-click multi-selection.
    previously_clicked_row: Option<usize>,
    /// Uuids of attachments that are pending to be saved after file dialog completion.
    pending_attachment_save: FxHashSet<Uuid>,
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
            clicked_row: None,
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

        let attachments = shared.attachments.attachments();

        egui::Panel::top("attachments_header")
            .resizable(false)
            .show_inside(ui, |ui| {
                self.render_attachments_header(ui, attachments.len());
            });

        // Details panel located at the bottom but needs to be rendered before the attachments list.
        if self.selected_rows.len() == 1 {
            egui::Panel::bottom("attachments_details")
                .resizable(true)
                .default_size(200.0)
                .size_range(
                    ATTACHMENTS_PREVIEW_MINIMUM_HEIGHT
                        ..=(ui.available_height() - ATTACHMENTS_LIST_MINIMUM_HEIGHT),
                )
                .show_inside(ui, |ui| {
                    egui::ScrollArea::vertical()
                        .auto_shrink(false)
                        .show(ui, |ui| {
                            self.render_attachment_preview(ui);
                        });
                });
        }

        // NOTE: CentralPanel should be added last as per egui documentation.
        egui::CentralPanel::default().show_inside(ui, |ui| {
            self.render_attachments_list(&shared.attachments, ui_actions, ui);
        });
    }

    fn render_attachments_header(&self, ui: &mut egui::Ui, attachments_count: usize) {
        egui::Sides::new().show(
            ui,
            |ui| ui.label(format!("Attachments ({})", attachments_count)),
            |ui| {
                ui.menu_button(
                    egui::RichText::new(egui_phosphor::regular::FUNNEL).size(16.0),
                    |ui| {
                        if ui
                            .button("Attachment filters not implemented yet")
                            .clicked()
                        {
                            ui.close();
                        }
                    },
                )
            },
        );
        ui.add_space(ui.spacing().item_spacing.y);
    }

    // TODO [TOOL-741]: Implement attachments preview.
    fn render_attachment_preview(&self, ui: &mut egui::Ui) {
        egui::ScrollArea::vertical().show(ui, |ui| {
            ui.add_space(ui.spacing().item_spacing.y);
            ui.label("Preview");
            ui.centered_and_justified(|ui| {
                ui.label(RichText::new("Attachment preview not implemented yet."));
            });
        });
    }

    fn render_attachments_list(
        &mut self,
        attachments_state: &AttachmentsState,
        ui_actions: &mut UiActions,
        ui: &mut egui::Ui,
    ) {
        let attachments = attachments_state.attachments();
        ui.spacing_mut().item_spacing.y = 0.0;
        let row_height = 2.0 * ui.text_style_height(&egui::TextStyle::Body)
            + ui.spacing().item_spacing.y
            + ROW_VERTICAL_PADDING;

        egui::Frame::default()
            .fill(ui.visuals().widgets.inactive.bg_fill)
            .corner_radius(6.0)
            .show(ui, |ui| {
                ui.add_space(row_height / 2.0);
                ui.horizontal(|ui| {
                    ui.add_space(ROW_HORIZONTAL_PADDING);
                    ui.label(
                        egui::RichText::new("Received attachments")
                            .size(12.0)
                            .strong(),
                    );
                });
                ui.add_space(row_height / 2.0);

                egui::ScrollArea::vertical().show_rows(
                    ui,
                    row_height,
                    attachments.len(),
                    |ui, row_range| {
                        for current_row in row_range {
                            let is_selected = self.selected_rows.contains(&current_row);
                            let attachment = &attachments[current_row];

                            let extension_color = attachment
                                .ext
                                .as_deref()
                                .and_then(|ext| attachments_state.color_by_extension(ext))
                                .unwrap_or(DEFAULT_ATTACHMENT_EXT_COLOR);

                            let response = self.render_attachment_row(
                                ui,
                                attachment,
                                extension_color,
                                row_height,
                                is_selected,
                            );

                            if response.clicked() {
                                self.clicked_row = Some(current_row);
                                self.handle_row_click(current_row, ui.input(|i| i.modifiers));
                            }

                            // TODO [TOOL-756]: Reevaluate secondary click logic
                            if response.secondary_clicked() {
                                self.clicked_row = Some(current_row);
                            }

                            response.context_menu(|ui| {
                                self.render_attachments_list_context_menu(
                                    ui,
                                    ui_actions,
                                    attachments,
                                );
                            });
                        }
                        ui.add_space(row_height / 2.0);
                    },
                );
            });
    }

    fn render_attachment_row(
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
            (true, true) => ui.visuals().selection.bg_fill.gamma_multiply(0.6),
            (true, false) => ui.visuals().selection.bg_fill,
            (false, true) => ui.visuals().widgets.hovered.bg_fill,
            (false, false) => ui.visuals().widgets.inactive.bg_fill,
        };
        ui.painter()
            .rect_filled(row_rectangle, 0, row_background_color);

        if is_selected {
            ui.painter().rect_filled(
                egui::Rect::from_min_size(
                    row_rectangle.min,
                    egui::vec2(4.0, row_rectangle.height()),
                ),
                egui::CornerRadius::same(0),
                ui.visuals().selection.stroke.color,
            );
        }

        ui.scope_builder(
            egui::UiBuilder::new()
                .max_rect(row_rectangle)
                .layout(egui::Layout::left_to_right(egui::Align::LEFT)),
            |ui| {
                // Extra padding from the left
                ui.add_space(ROW_HORIZONTAL_PADDING);

                ui.add_sized(
                    egui::vec2(EXT_COLUMN_WIDTH, row_height),
                    egui::Label::new(
                        egui::RichText::new(
                            attachment.ext.as_deref().unwrap_or("—").to_uppercase(),
                        )
                        .strong()
                        .color(extension_color),
                    ),
                );
                ui.vertical(|ui| {
                    ui.add_space(ROW_VERTICAL_PADDING / 2.0);
                    ui.add(egui::Label::new(&attachment.name).truncate());
                    ui.add(
                        egui::Label::new(
                            egui::RichText::new(file_utls::format_file_size(
                                attachment.size as u64,
                            ))
                            .weak(),
                        )
                        .truncate(),
                    );
                });
            },
        );

        response
    }

    fn render_attachments_list_context_menu(
        &mut self,
        ui: &mut egui::Ui,
        ui_actions: &mut UiActions,
        attachments: &[AttachmentInfo],
    ) {
        let attachment_count = attachments.len();

        if ui.button("Select all").clicked() {
            self.selected_rows.clear();
            self.selected_rows.extend(0..attachment_count);
            ui.close();
        }
        if ui.button("Invert selection").clicked() {
            let all_rows: FxHashSet<usize> = (0..attachment_count).collect();
            self.selected_rows = all_rows.difference(&self.selected_rows).copied().collect();
            ui.close();
        }
        ui.separator();

        if ui.button(RichText::new("Save as")).clicked()
            && let Some(attachment) = self.clicked_row.and_then(|r| attachments.get(r))
        {
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

    fn handle_row_click(&mut self, clicked_row: usize, modifiers: egui::Modifiers) {
        if modifiers.matches_exact(Modifiers::CTRL) {
            if self.selected_rows.contains(&clicked_row) {
                self.selected_rows.remove(&clicked_row);
            } else {
                self.selected_rows.insert(clicked_row);
            }
        }

        if modifiers.matches_exact(Modifiers::SHIFT)
            && let Some(previously_clicked_row) = self.previously_clicked_row
        {
            let shift_range = match previously_clicked_row.cmp(&clicked_row) {
                Ordering::Less => previously_clicked_row..=clicked_row,
                Ordering::Greater => clicked_row..=previously_clicked_row,
                Ordering::Equal => clicked_row..=clicked_row,
            };

            for row in shift_range {
                self.selected_rows.insert(row);
            }
        }

        if modifiers.matches_exact(Modifiers::NONE) {
            if self.selected_rows.len() == 1 && self.selected_rows.contains(&clicked_row) {
                self.selected_rows.clear();
            } else {
                self.selected_rows.clear();
                self.selected_rows.insert(clicked_row);
            }
        }
        self.previously_clicked_row = Some(clicked_row);
    }
}
