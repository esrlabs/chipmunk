use std::{
    ops::{Range, RangeInclusive},
    rc::Rc,
    sync::mpsc::Receiver as StdReceiver,
};

use egui::{Sense, TextBuffer, Ui};
use egui_table::{CellInfo, HeaderCellInfo, PrefetchInfo, TableDelegate};
use tokio::sync::mpsc::Sender;

use processor::grabber::LineRange;
use stypes::GrabbedElement;

use crate::{
    host::{
        common::parsers::ParserNames,
        ui::{UiActions, state::HostPreferences},
    },
    session::{
        command::{ExportTarget, SessionCommand},
        error::SessionError,
        types::attachment::{PreviewKind, PreviewRequest, PreviewTarget, kind_for_mime},
        ui::{
            bottom_panel::BottomTabType,
            common::{
                self,
                log_table::{
                    LogTableKind,
                    table::{
                        self, TableScroll, activate_table_on_click, columns_filling_last,
                        grab_cmd_consts, render_active_table_indicator, render_row_header,
                        should_stick_to_bottom, sync_column_widths,
                    },
                    text::render_log_cell_text,
                },
                logs_mapped::LogsMapped,
            },
            definitions::schema::LogSchema,
            shared::{SearchTableSync, SessionShared, export},
        },
    },
};

const TABLE_ID_SALT: &str = "logs_table";
const EXPORT_DIALOG_ID: &str = "logs_table_export";

/// This is used for storing some attachment state during rendering of the logs table only.
pub enum LogAttachmentInfo {
    NoAttachment,
    WithAttachment { color: Option<egui::Color32> },
}

#[derive(Debug)]
pub struct LogsTable {
    logs: LogsMapped,
    last_visible_rows: Option<Range<u64>>,
    pending_scroll: Option<RangeInclusive<u64>>,
    cmd_tx: Sender<SessionCommand>,
    /// Logs receiver from previous frame if receive function timed out
    /// on that frame.
    pending_logs_rx: Option<StdReceiver<Result<Vec<GrabbedElement>, SessionError>>>,
    schema: Rc<dyn LogSchema>,
}

impl LogsTable {
    pub fn new(cmd_tx: Sender<SessionCommand>, schema: Rc<dyn LogSchema>) -> Self {
        Self {
            cmd_tx,
            last_visible_rows: Default::default(),
            pending_scroll: None,
            logs: LogsMapped::new(Rc::clone(&schema)),
            pending_logs_rx: None,
            schema,
        }
    }

    pub fn render_content(
        &mut self,
        shared: &mut SessionShared,
        actions: &mut UiActions,
        preferences: &mut HostPreferences,
        ui: &mut Ui,
    ) {
        // Disable fade effects on tables to avoid highlighting clashing.
        ui.style_mut().spacing.scroll.fade.strength = 0.0;

        // Ensure the border of last column isn't visible.
        let columns = columns_filling_last(ui, TABLE_ID_SALT, &shared.view.log_columns);

        let mut table = egui_table::Table::new()
            .id_salt(TABLE_ID_SALT)
            .num_rows(shared.logs.logs_count)
            .columns(columns)
            .num_sticky_cols(1)
            .stick_to_bottom(should_stick_to_bottom(shared));

        if !self.schema.has_headers() {
            table = table.headers(Vec::new());
        }

        let search_table_visible =
            preferences.panels_visibility.bottom && shared.bottom_tab == BottomTabType::Search;

        if let Some(focus) = shared.logs.take_main_row_focus() {
            const OFFSET: u64 = 3;
            table = table.scroll_to_rows(
                focus.row.saturating_sub(OFFSET)..=focus.row.saturating_add(OFFSET),
                None,
            );

            let details_row = shared
                .logs
                .single_selected_row()
                .is_some_and(|row| row == focus.row)
                .then_some(focus.row);
            let search_row =
                (focus.search_table_sync == SearchTableSync::Sync).then_some(focus.row);

            sync_focused_row(
                actions,
                &self.cmd_tx,
                details_row,
                search_row,
                search_table_visible,
            );
        }

        if let Some(rows) = self.pending_scroll.take() {
            table = table.scroll_to_rows(rows, None);
        }
        let mut delegate = LogsDelegate::new(self, shared, actions, search_table_visible);
        let response = table.show(ui, &mut delegate);
        response.context_menu(|ui| {
            delegate
                .table
                .render_context_menu(delegate.shared, delegate.actions, ui);
        });

        if delegate.request_repaint {
            ui.request_repaint();
        }

        activate_table_on_click(ui, &response.rect, &mut shared.view, LogTableKind::Main);
        render_active_table_indicator(ui, &response.rect, &shared.view, LogTableKind::Main);

        sync_column_widths(ui, TABLE_ID_SALT, &mut shared.view.log_columns);
    }

    fn render_context_menu(
        &mut self,
        shared: &mut SessionShared,
        actions: &mut UiActions,
        ui: &mut Ui,
    ) {
        table::render_unselect_action(shared, ui);

        let selected_count = shared.logs.selected_count();
        let can_start_export = shared.exports.can_start();

        match shared.get_info().parser {
            ParserNames::Text | ParserNames::Plugins => {
                let selected_label = if selected_count == 0 {
                    String::from("Export Selected")
                } else {
                    format!("Export {selected_count} row(s)")
                };

                if ui
                    .add_enabled(
                        can_start_export && selected_count > 0,
                        egui::Button::new(selected_label),
                    )
                    .clicked()
                {
                    let target = ExportTarget::Rows(shared.logs.selected_rows());
                    let file_name = export::default_text_file_name(shared);
                    shared.exports.open_text_dialog(
                        actions,
                        target,
                        export::full_row_text_options(),
                        EXPORT_DIALOG_ID,
                        "Export Selected",
                        file_name,
                    );
                    ui.close();
                }
            }
            ParserNames::Dlt | ParserNames::SomeIP => {
                let selected_label = if selected_count == 0 {
                    String::from("Export Selected as Table")
                } else {
                    format!("Export {selected_count} row(s) as Table")
                };

                if ui
                    .add_enabled(
                        can_start_export && selected_count > 0,
                        egui::Button::new(selected_label),
                    )
                    .clicked()
                {
                    let schema = Rc::clone(&self.schema);
                    let target = ExportTarget::Rows(shared.logs.selected_rows());
                    let file_name = export::default_text_file_name(shared);
                    shared.exports.open_text_modal(
                        target,
                        "Export Selected as Table",
                        schema.as_ref(),
                        EXPORT_DIALOG_ID,
                        file_name,
                    );
                    ui.close();
                }
            }
        }

        let can_export_raw =
            shared.get_info().raw_export_supported() && can_start_export && selected_count > 0;
        let selected_export_label = if selected_count == 0 {
            String::from("Export Selected as Raw")
        } else {
            format!("Export Selected Rows ({selected_count}) as Raw")
        };

        if ui
            .add_enabled(can_export_raw, egui::Button::new(selected_export_label))
            .clicked()
        {
            let target = ExportTarget::Rows(shared.logs.selected_rows());
            let file_name = export::default_raw_file_name(shared);
            shared.exports.open_raw_dialog(
                actions,
                target,
                EXPORT_DIALOG_ID,
                "Export Selected as Raw",
                file_name,
            );
            ui.close();
        }

        match shared.get_info().parser {
            ParserNames::Text | ParserNames::Plugins => {
                if ui
                    .add_enabled(
                        can_start_export && shared.logs.logs_count > 0,
                        egui::Button::new("Export All Logs"),
                    )
                    .clicked()
                {
                    let file_name = export::default_text_file_name(shared);
                    shared.exports.open_text_dialog(
                        actions,
                        ExportTarget::All,
                        export::full_row_text_options(),
                        EXPORT_DIALOG_ID,
                        "Export All Logs",
                        file_name,
                    );
                    ui.close();
                }
            }
            ParserNames::Dlt | ParserNames::SomeIP => {
                if ui
                    .add_enabled(
                        can_start_export && shared.logs.logs_count > 0,
                        egui::Button::new("Export All as Table"),
                    )
                    .clicked()
                {
                    let schema = Rc::clone(&self.schema);
                    let file_name = export::default_text_file_name(shared);
                    shared.exports.open_text_modal(
                        ExportTarget::All,
                        "Export All as Table",
                        schema.as_ref(),
                        EXPORT_DIALOG_ID,
                        file_name,
                    );
                    ui.close();
                }
            }
        }
    }

    /// Queues a vertical table scroll for the next render pass.
    pub fn scroll(&mut self, action: TableScroll, row_count: u64) {
        if let Some(target) =
            table::scroll_target(action, self.last_visible_rows.as_ref(), row_count)
        {
            self.pending_scroll = Some(target);
        }
    }
}

/// Applies side effects for a main row focus produced by clicks or external jump requests.
fn sync_focused_row(
    actions: &mut UiActions,
    cmd_tx: &Sender<SessionCommand>,
    details_row: Option<u64>,
    search_row: Option<u64>,
    search_table_visible: bool,
) {
    if let Some(details_row) = details_row {
        actions.try_send_command(cmd_tx, SessionCommand::GetSelectedLog(details_row));
    }

    if search_table_visible && let Some(search_row) = search_row {
        actions.try_send_command(cmd_tx, SessionCommand::GetNearestPosition(search_row));
    }
}

#[derive(Debug)]
struct LogsDelegate<'a> {
    table: &'a mut LogsTable,
    shared: &'a mut SessionShared,
    actions: &'a mut UiActions,
    request_repaint: bool,
    has_multi_sources: bool,
    search_table_visible: bool,
    /// One physical click can be reported twice for the same row: once by the row-wide
    /// background response in `row_ui`, and once by a child widget response from the
    /// header or cell content. Selection updates are not idempotent for toggle and range
    /// cases, so handling both would apply the click semantics twice in one frame.
    /// This tracks which row already consumed the click for the current delegate pass.
    handled_selection_click_row: Option<u64>,
}

impl<'a> LogsDelegate<'a> {
    fn new(
        table: &'a mut LogsTable,
        shared: &'a mut SessionShared,
        actions: &'a mut UiActions,
        search_table_visible: bool,
    ) -> Self {
        let has_multi_sources = shared.observe.sources_count() > 1;
        Self {
            table,
            shared,
            actions,
            request_repaint: false,
            has_multi_sources,
            search_table_visible,
            handled_selection_click_row: None,
        }
    }

    fn select_row(&mut self, row_nr: u64, modifiers: egui::Modifiers) {
        let change =
            common::log_table::table::apply_selection_click(self.shared, row_nr, modifiers);

        sync_focused_row(
            self.actions,
            &self.table.cmd_tx,
            change.details_row,
            change.jump_to_row,
            self.search_table_visible,
        );
    }

    fn handle_selection_click(&mut self, row_nr: u64, modifiers: egui::Modifiers) {
        if self.handled_selection_click_row == Some(row_nr) {
            return;
        }

        self.handled_selection_click_row = Some(row_nr);
        self.select_row(row_nr, modifiers);
    }

    fn toggle_row_bookmark(&mut self, row_nr: u64) {
        let cmd = if self.shared.logs.is_bookmarked(row_nr) {
            SessionCommand::RemoveBookmark(row_nr)
        } else {
            SessionCommand::AddBookmarks(vec![row_nr])
        };
        self.actions.try_send_command(&self.table.cmd_tx, cmd);
    }

    fn render_row_header(&mut self, ui: &mut Ui, cell: &CellInfo) {
        let source_color_idx = self
            .has_multi_sources
            .then(|| {
                self.table
                    .logs
                    .get_log_item(&cell.row_nr)
                    .map(|item| item.element.source_id as usize)
            })
            .flatten();
        let is_bookmarked = self.shared.logs.is_bookmarked(cell.row_nr);

        let attachment_id = self
            .shared
            .attachments
            .attachment_by_log_position(cell.row_nr as usize)
            .map(|attachment| attachment.uuid);
        let attachment_info =
            attachment_id.map_or(LogAttachmentInfo::NoAttachment, |attachment_id| {
                LogAttachmentInfo::WithAttachment {
                    color: self.shared.attachments.color_by_uuid(&attachment_id),
                }
            });

        let header = render_row_header(
            ui,
            cell.row_nr.to_string(),
            source_color_idx,
            is_bookmarked,
            attachment_info,
        );

        header.response.context_menu(|ui| {
            self.table
                .render_context_menu(self.shared, self.actions, ui)
        });

        if header.attachment_clicked {
            if let Some(attachment_id) = attachment_id
                && let Some(attachment) = self
                    .shared
                    .attachments
                    .attachment_by_uuid(&attachment_id)
                    .cloned()
            {
                let kind = kind_for_mime(attachment.mime.as_deref());
                match kind {
                    PreviewKind::Unsupported => {
                        self.shared.attachments.show_preview_unsupported(attachment);
                    }
                    PreviewKind::Text | PreviewKind::Image => {
                        self.shared
                            .attachments
                            .show_preview_pending(attachment.clone());

                        let request = PreviewRequest {
                            attachment_id,
                            filepath: attachment.filepath.clone(),
                            kind,
                            target: PreviewTarget::Modal,
                        };
                        if !self.actions.try_send_command(
                            &self.table.cmd_tx,
                            SessionCommand::PreviewAttachment(request),
                        ) {
                            self.shared.attachments.close_pending_modal(attachment_id);
                        }
                    }
                }
            }
        } else if header.bookmark_clicked {
            self.toggle_row_bookmark(cell.row_nr);
        } else if header.response.clicked() {
            self.handle_selection_click(cell.row_nr, ui.input(|i| i.modifiers));
        }
    }

    fn render_log_cell(&mut self, ui: &mut Ui, cell: &CellInfo) {
        let mut source_changed = false;

        let &CellInfo { col_nr, row_nr, .. } = cell;

        common::log_table::table::get_cell_frame().show(ui, |ui| {
            let Some(item) = self.table.logs.get_log_item(&row_nr) else {
                // Ensure data will be requested on next frame.
                if self.table.pending_logs_rx.is_none() {
                    self.table.last_visible_rows = None;
                }

                let response = ui.monospace("Loading...");
                response.context_menu(|ui| {
                    self.table
                        .render_context_menu(self.shared, self.actions, ui)
                });
                if response.clicked() {
                    self.handle_selection_click(row_nr, ui.input(|i| i.modifiers));
                }
                return;
            };

            source_changed = self.has_multi_sources
                && self
                    .table
                    .logs
                    .source_change_positions()
                    .contains(&item.element.pos);

            let col_idx = col_nr.saturating_sub(1);
            let response = render_log_cell_text(ui, item, col_idx, self.shared);

            if response.clicked() {
                self.handle_selection_click(row_nr, ui.input(|i| i.modifiers));
            }

            response.context_menu(|ui| {
                self.table
                    .render_context_menu(self.shared, self.actions, ui)
            });
        });

        if source_changed {
            table::render_upper_bound(ui);
        }
    }
}

impl TableDelegate for LogsDelegate<'_> {
    fn prepare(&mut self, info: &PrefetchInfo) {
        if self.shared.logs.logs_count == 0 {
            return;
        }

        let PrefetchInfo { visible_rows, .. } = info;

        let logs_rx = if self
            .table
            .last_visible_rows
            .as_ref()
            .is_some_and(|row| row == visible_rows)
        {
            // Check if we still have pending receive calls which
            // have timed out in previous frames.
            match self.table.pending_logs_rx.take() {
                Some(logs_rx) => logs_rx,
                None => return,
            }
        } else {
            // Request new data.
            self.table.last_visible_rows = Some(info.visible_rows.to_owned());

            let range = LineRange::from(visible_rows.start..=visible_rows.end.saturating_sub(1));

            let (logs_tx, logs_rx) = std::sync::mpsc::channel();
            let cmd = SessionCommand::GrabLinesBlocking {
                range,
                sender: logs_tx,
            };

            if !self.actions.send_command_with_retry(
                &self.table.cmd_tx,
                cmd,
                grab_cmd_consts::SEND_INTERVAL,
                grab_cmd_consts::SEND_RETRY_MAX_COUNT,
            ) {
                return;
            }

            logs_rx
        };

        if let Ok(elements) = logs_rx.recv_timeout(grab_cmd_consts::TIMEOUT_DURATION) {
            match elements {
                Ok(elements) => self.table.logs.append(
                    elements.into_iter().map(|e| (e.pos as u64, e)),
                    self.has_multi_sources,
                ),
                Err(error) => {
                    common::log_table::table::handle_grab_errors(
                        error,
                        self.shared.get_id(),
                        self.actions,
                    );
                }
            }
        } else {
            log::debug!("Grabber request timed out. Frame is passed without updating data.");
            self.table.pending_logs_rx = Some(logs_rx);
            self.request_repaint = true;
        }
    }

    fn header_cell_ui(&mut self, ui: &mut Ui, cell: &HeaderCellInfo) {
        common::log_table::table::get_cell_frame().show(ui, |ui| {
            let (header, tooltip) = match cell.group_index {
                0 => ("Nr.", "Log Position"),
                idx => self
                    .table
                    .schema
                    .columns()
                    .get(idx.saturating_sub(1))
                    .map(|col| (col.header.as_str(), col.header_tooltip.as_str()))
                    .unwrap_or_default(),
            };

            ui.label(header).on_hover_text(tooltip);
        });
    }

    fn row_ui(&mut self, ui: &mut Ui, row_nr: u64) {
        let is_selected = self.shared.logs.is_selected(row_nr);
        common::log_table::table::apply_log_row_colors(ui, self.shared, Some(row_nr), is_selected);

        let response = ui.response().interact(Sense::click());
        if response.clicked() {
            self.handle_selection_click(row_nr, ui.input(|i| i.modifiers));
        }
        response.context_menu(|ui| {
            self.table
                .render_context_menu(self.shared, self.actions, ui)
        });
    }

    fn cell_ui(&mut self, ui: &mut egui::Ui, cell: &egui_table::CellInfo) {
        // Users should be able to select the content of log files.
        ui.style_mut().interaction.selectable_labels = true;

        match cell.col_nr {
            0 => {
                self.render_row_header(ui, cell);
            }
            _ => {
                self.render_log_cell(ui, cell);
            }
        }
    }
}
