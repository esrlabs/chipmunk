use std::{ops::Range, rc::Rc};

use egui::{Sense, TextBuffer, Ui};
use egui_table::{CellInfo, Column, HeaderCellInfo, PrefetchInfo, TableDelegate};
use processor::grabber::LineRange;
use std::sync::mpsc::Receiver as StdReceiver;
use stypes::GrabbedElement;
use tokio::sync::mpsc::Sender;

use crate::{
    host::ui::UiActions,
    session::{
        command::SessionCommand,
        error::SessionError,
        ui::{
            bottom_panel::BottomTabType,
            common::{
                self,
                logs_mapped::LogsMapped,
                logs_tables::{grab_cmd_consts, should_stick_to_bottom},
            },
            definitions::schema::LogSchema,
            shared::SessionShared,
        },
    },
};

/// This is used for storing some attachment state during rendering of the logs table only.
pub enum LogAttachmentInfo {
    NoAttachment,
    WithAttachment { color: Option<egui::Color32> },
}

#[derive(Debug)]
pub struct LogsTable {
    logs: LogsMapped,
    last_visible_rows: Option<Range<u64>>,
    cmd_tx: Sender<SessionCommand>,
    /// Logs receiver from previous frame if receive function timed out
    /// on that frame.
    pending_logs_rx: Option<StdReceiver<Result<Vec<GrabbedElement>, SessionError>>>,
    schema: Rc<dyn LogSchema>,
    columns: Box<[Column]>,
}

impl LogsTable {
    pub fn new(cmd_tx: Sender<SessionCommand>, schema: Rc<dyn LogSchema>) -> Self {
        let columns = common::logs_tables::create_table_columns(schema.as_ref());

        Self {
            cmd_tx,
            last_visible_rows: Default::default(),
            logs: LogsMapped::new(Rc::clone(&schema)),
            pending_logs_rx: None,
            schema,
            columns,
        }
    }

    pub fn render_content(
        &mut self,
        shared: &mut SessionShared,
        actions: &mut UiActions,
        ui: &mut Ui,
    ) {
        // Disable fade effects on tables to avoid highlighting clashing.
        ui.style_mut().spacing.scroll.fade.strength = 0.0;

        let mut table = egui_table::Table::new()
            .id_salt("logs_table")
            .num_rows(shared.logs.logs_count)
            .columns(self.columns.as_ref())
            .num_sticky_cols(1)
            .stick_to_bottom(should_stick_to_bottom(shared));

        if !self.schema.has_headers() {
            table = table.headers(Vec::new());
        }

        if let Some(row) = shared.logs.scroll_main_row.take() {
            const OFFSET: u64 = 3;
            table = table.scroll_to_rows(row.saturating_sub(OFFSET)..=(row + OFFSET), None);
        }

        let mut delegate = LogsDelegate::new(self, shared, actions);
        table.show(ui, &mut delegate);

        if delegate.request_repaint {
            ui.request_repaint();
        }
    }
}

#[derive(Debug)]
struct LogsDelegate<'a> {
    table: &'a mut LogsTable,
    shared: &'a mut SessionShared,
    actions: &'a mut UiActions,
    request_repaint: bool,
    has_multi_sources: bool,
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
    ) -> Self {
        let has_multi_sources = shared.observe.sources_count() > 1;
        Self {
            table,
            shared,
            actions,
            request_repaint: false,
            has_multi_sources,
            handled_selection_click_row: None,
        }
    }

    fn select_row(&mut self, row_nr: u64, modifiers: egui::Modifiers) {
        let Some(selected_row) = common::logs_tables::apply_selection_click(
            self.shared,
            self.actions,
            &self.table.cmd_tx,
            row_nr,
            modifiers,
        ) else {
            return;
        };

        // Keep the search table aligned only while it is visible.
        if self.shared.bottom_tab == BottomTabType::Search {
            let nearest_cmd = SessionCommand::GetNearestPosition(selected_row);
            self.actions
                .try_send_command(&self.table.cmd_tx, nearest_cmd);
        }
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
        let color_idx = self
            .has_multi_sources
            .then(|| {
                self.table
                    .logs
                    .get_log_item(&cell.row_nr)
                    .map(|item| item.element.source_id as usize)
            })
            .flatten();
        let is_bookmarked = self.shared.logs.is_bookmarked(cell.row_nr);

        let attachment_info = self
            .shared
            .attachments
            .attachment_by_log_position(cell.row_nr as usize)
            .map_or(LogAttachmentInfo::NoAttachment, |attachment| {
                LogAttachmentInfo::WithAttachment {
                    color: self.shared.attachments.color_by_uuid(&attachment.uuid),
                }
            });

        let response = common::logs_tables::render_row_header(
            ui,
            cell.row_nr.to_string(),
            color_idx,
            is_bookmarked,
            || self.toggle_row_bookmark(cell.row_nr),
            attachment_info,
        );

        if response.clicked() {
            self.handle_selection_click(cell.row_nr, ui.input(|i| i.modifiers));
        }
    }

    fn render_log_cell(&mut self, ui: &mut Ui, cell: &CellInfo) {
        let mut source_changed = false;

        let &CellInfo { col_nr, row_nr, .. } = cell;

        common::logs_tables::get_cell_frame().show(ui, |ui| {
            let content = match self.table.logs.get_log_item(&row_nr) {
                Some(item) => {
                    source_changed = self.has_multi_sources
                        && self
                            .table
                            .logs
                            .source_change_positions()
                            .contains(&item.element.pos);
                    let col_idx = col_nr.saturating_sub(1);
                    item.column_ranges
                        .get(col_idx)
                        .and_then(|rng| item.element.content.get(rng.clone()))
                        .unwrap_or_default()
                }
                None => {
                    // Ensure data will be requested on next frame.
                    if self.table.pending_logs_rx.is_none() {
                        self.table.last_visible_rows = None;
                    }

                    "Loading..."
                }
            };

            let response = match common::logs_tables::highlighted_cell_layout_job(
                ui,
                content,
                row_nr,
                self.shared,
                self.shared.search.compiled_filters(),
            ) {
                Some(job) => ui.label(job),
                None => ui.label(content),
            };

            if response.clicked() {
                self.handle_selection_click(row_nr, ui.input(|i| i.modifiers));
            }
        });

        if source_changed {
            common::logs_tables::render_upper_bound(ui);
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
                    common::logs_tables::handle_grab_errors(
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
        common::logs_tables::get_cell_frame().show(ui, |ui| {
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
        common::logs_tables::apply_log_row_colors(ui, self.shared, Some(row_nr), is_selected);

        if ui.response().interact(Sense::click()).clicked() {
            self.handle_selection_click(row_nr, ui.input(|i| i.modifiers));
        }
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
