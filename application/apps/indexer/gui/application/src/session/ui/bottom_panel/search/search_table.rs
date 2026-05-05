use std::{
    ops::{Range, RangeInclusive},
    rc::Rc,
    sync::mpsc::Receiver as StdReceiver,
};

use egui::{Sense, Ui};
use egui_table::{CellInfo, PrefetchInfo, TableDelegate};
use stypes::{GrabbedElement, NearestPosition};
use tokio::sync::mpsc::Sender;

use crate::{
    host::ui::UiActions,
    session::{
        command::SessionCommand,
        error::SessionError,
        types::attachment::{PreviewKind, PreviewRequest, PreviewTarget, kind_for_mime},
        ui::{
            common::{
                self,
                log_table::{
                    LogTableKind,
                    table::{
                        TableScroll, activate_table_on_click, apply_columns_to_table_state,
                        grab_cmd_consts, render_active_table_indicator, render_row_header,
                        should_stick_to_bottom,
                    },
                    text::render_log_cell_text,
                },
                logs_mapped::LogsMapped,
            },
            definitions::{LogTableItem, schema::LogSchema},
            logs_table::LogAttachmentInfo,
            shared::{SearchTableSync, SessionShared},
        },
    },
};

const TABLE_ID_SALT: &str = "search_table";

#[derive(Debug)]
pub struct SearchTable {
    cmd_tx: Sender<SessionCommand>,
    last_visible_rows: Option<Range<u64>>,
    pending_scroll: Option<RangeInclusive<u64>>,
    indexed_logs: LogsMapped,
    /// Logs receiver from previous frame if receive function timed out
    /// on that frame.
    pending_logs_rx: Option<StdReceiver<Result<Vec<GrabbedElement>, SessionError>>>,
    /// The indexed lower-table row to make the table scroll toward.
    scroll_nearest_pos: Option<NearestPosition>,
}

impl SearchTable {
    pub fn new(cmd_tx: Sender<SessionCommand>, schema: Rc<dyn LogSchema>) -> Self {
        Self {
            cmd_tx,
            last_visible_rows: None,
            pending_scroll: None,
            indexed_logs: LogsMapped::new(schema),
            pending_logs_rx: None,
            scroll_nearest_pos: None,
        }
    }

    pub fn set_nearest_pos(&mut self, nearest_pos: Option<NearestPosition>) {
        self.scroll_nearest_pos = nearest_pos;
    }

    pub fn render_content(
        &mut self,
        shared: &mut SessionShared,
        actions: &mut UiActions,
        ui: &mut Ui,
    ) {
        // Disable fade effects on tables to avoid highlighting clashing.
        ui.style_mut().spacing.scroll.fade.strength = 0.0;

        let columns = shared
            .view
            .log_columns
            .iter()
            .map(|column| {
                let width = column.range.clamp(column.current);
                // Do not use resizable(false): egui_table skips painting vertical
                // column borders for non-resizable columns. Keep resize handles
                // enabled, but lock the range to the main table width.
                column.range(width..=width)
            })
            .collect::<Vec<_>>();
        apply_columns_to_table_state(ui, TABLE_ID_SALT, &columns);

        let mut table = egui_table::Table::new()
            .id_salt(TABLE_ID_SALT)
            .num_rows(shared.search.indexed_result_count())
            .headers(Vec::new())
            .columns(columns)
            .num_sticky_cols(1)
            .stick_to_bottom(should_stick_to_bottom(shared));

        if let Some(row_nr) = take_ready_nearest_row(
            &mut self.scroll_nearest_pos,
            shared.search.indexed_result_count(),
        ) {
            const OFFSET: u64 = 2;
            table = table.scroll_to_rows(row_nr.saturating_sub(OFFSET)..=row_nr + OFFSET, None);
        }

        if let Some(rows) = self.pending_scroll.take() {
            table = table.scroll_to_rows(rows, None);
        }

        let mut delegate = LogsDelegate::new(self, shared, actions);
        let response = table.show(ui, &mut delegate);

        if delegate.request_repaint {
            ui.request_repaint();
        }

        activate_table_on_click(ui, &response.rect, &mut shared.view, LogTableKind::Search);
        render_active_table_indicator(ui, &response.rect, &shared.view, LogTableKind::Search);
    }

    pub fn clear(&mut self) {
        let Self {
            cmd_tx: _,
            last_visible_rows,
            pending_scroll,
            indexed_logs,
            pending_logs_rx,
            scroll_nearest_pos,
        } = self;

        *last_visible_rows = None;
        *pending_scroll = None;
        indexed_logs.clear();
        *scroll_nearest_pos = None;
        *pending_logs_rx = None;
    }

    /// Queues a vertical table scroll for the next render pass.
    pub fn scroll(&mut self, action: TableScroll, row_count: u64) {
        if let Some(target) = common::log_table::table::scroll_target(
            action,
            self.last_visible_rows.as_ref(),
            row_count,
        ) {
            self.pending_scroll = Some(target);
        }
    }
}

#[derive(Debug)]
struct LogsDelegate<'a> {
    table: &'a mut SearchTable,
    shared: &'a mut SessionShared,
    actions: &'a mut UiActions,
    request_repaint: bool,
    has_multi_sources: bool,
    /// Dedupes row/background and child-widget clicks for the same row in one pass.
    /// Please refer to logs table for more details.
    handled_selection_click_row: Option<u64>,
}

impl<'a> LogsDelegate<'a> {
    fn new(
        table: &'a mut SearchTable,
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

    #[inline(always)]
    fn is_row_selected(&self, log_item: Option<&LogTableItem>) -> bool {
        log_item.is_some_and(|item| self.shared.logs.is_selected(item.element.pos as u64))
    }

    fn select_row(&mut self, pos: u64, modifiers: egui::Modifiers) {
        let change = common::log_table::table::apply_selection_click(self.shared, pos, modifiers);

        if let Some(details_row) = change.details_row {
            self.shared
                .logs
                .request_main_row_focus(details_row, SearchTableSync::Skip);
        }
    }

    fn handle_selection_click(&mut self, pos: u64, modifiers: egui::Modifiers) {
        if self.handled_selection_click_row == Some(pos) {
            return;
        }

        self.handled_selection_click_row = Some(pos);
        self.select_row(pos, modifiers);
    }

    fn toggle_row_bookmark(&mut self, pos: u64) {
        let cmd = if self.shared.logs.is_bookmarked(pos) {
            SessionCommand::RemoveBookmark(pos)
        } else {
            SessionCommand::AddBookmarks(vec![pos])
        };
        self.actions.try_send_command(&self.table.cmd_tx, cmd);
    }

    fn get_log_item(&self, cell: &CellInfo) -> Option<&LogTableItem> {
        self.table.indexed_logs.get_log_item(&cell.row_nr)
    }

    fn render_row_header(&mut self, ui: &mut Ui, cell: &CellInfo) {
        let Some(log_item) = self.get_log_item(cell) else {
            return;
        };

        let log_position = log_item.element.pos;
        let source_color_idx = self
            .has_multi_sources
            .then_some(log_item.element.source_id as usize);
        let is_bookmarked = self.shared.logs.is_bookmarked(log_position as u64);

        let attachment_id = self
            .shared
            .attachments
            .attachment_by_log_position(log_position)
            .map(|attachment| attachment.uuid);
        let attachment_info =
            attachment_id.map_or(LogAttachmentInfo::NoAttachment, |attachment_id| {
                LogAttachmentInfo::WithAttachment {
                    color: self.shared.attachments.color_by_uuid(&attachment_id),
                }
            });

        let header = render_row_header(
            ui,
            log_position.to_string(),
            source_color_idx,
            is_bookmarked,
            attachment_info,
        );

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
            self.toggle_row_bookmark(log_position as u64);
        } else if header.response.clicked() {
            self.handle_selection_click(log_position as u64, ui.input(|i| i.modifiers));
        }
    }

    fn render_log_cell(&mut self, ui: &mut Ui, cell: &CellInfo) {
        let mut source_changed = false;

        common::log_table::table::get_cell_frame().show(ui, |ui| {
            let log_item = match self.get_log_item(cell) {
                Some(log) => log,
                None => {
                    // Ensure data will be requested on next frame.
                    if self.table.pending_logs_rx.is_none() {
                        self.table.last_visible_rows = None;
                    }

                    ui.label("Loading...");
                    return;
                }
            };

            source_changed = self.has_multi_sources
                && self
                    .table
                    .indexed_logs
                    .source_change_positions()
                    .contains(&log_item.element.pos);

            let col_idx = cell.col_nr.saturating_sub(1);
            let response = render_log_cell_text(ui, log_item, col_idx, self.shared);

            if response.clicked() {
                self.handle_selection_click(log_item.element.pos as u64, ui.input(|i| i.modifiers));
            }
        });

        if source_changed {
            common::log_table::table::render_upper_bound(ui);
        }
    }
}

impl TableDelegate for LogsDelegate<'_> {
    fn prepare(&mut self, info: &PrefetchInfo) {
        if self.shared.logs.logs_count == 0 {
            return;
        }

        if self.shared.search.indexed_result_count() == 0 {
            self.table.last_visible_rows = None;
            self.table.pending_logs_rx = None;
            return;
        }

        let PrefetchInfo { visible_rows, .. } = info;

        let rng = visible_rows.start..=visible_rows.end.saturating_sub(1);

        let logs_rx = if self
            .table
            .last_visible_rows
            .as_ref()
            .is_some_and(|v| v == visible_rows)
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

            let (elems_tx, elems_rx) = std::sync::mpsc::channel();
            let cmd = SessionCommand::GrabIndexedLinesBlocking {
                range: rng.clone(),
                sender: elems_tx,
            };

            if !self.actions.send_command_with_retry(
                &self.table.cmd_tx,
                cmd,
                grab_cmd_consts::SEND_INTERVAL,
                grab_cmd_consts::SEND_RETRY_MAX_COUNT,
            ) {
                return;
            }

            elems_rx
        };

        if let Ok(elements) = logs_rx.recv_timeout(grab_cmd_consts::TIMEOUT_DURATION) {
            match elements {
                Ok(elements) => {
                    let combined = rng.zip(elements);
                    self.table
                        .indexed_logs
                        .append(combined, self.has_multi_sources);
                }
                Err(error) => {
                    common::log_table::table::handle_grab_errors(
                        error,
                        self.shared.get_id(),
                        self.actions,
                    );
                }
            }
        } else {
            log::debug!(
                "Grabber Indexed request timed out. Frame is passed without updating data."
            );
            self.table.pending_logs_rx = Some(logs_rx);
            self.request_repaint = true;
        }
    }

    fn header_cell_ui(&mut self, _ui: &mut Ui, _cell: &egui_table::HeaderCellInfo) {
        panic!("search table doesn't have headers");
    }

    fn row_ui(&mut self, ui: &mut Ui, row_nr: u64) {
        let log_item = self.table.indexed_logs.get_log_item(&row_nr);

        let is_selected = self.is_row_selected(log_item);
        let main_log_pos = log_item.map(|item| item.element.pos as u64);
        common::log_table::table::apply_log_row_colors(ui, self.shared, main_log_pos, is_selected);

        if ui.response().interact(Sense::click()).clicked()
            && let Some(log_item) = log_item
        {
            self.handle_selection_click(log_item.element.pos as u64, ui.input(|i| i.modifiers));
        }
    }

    fn cell_ui(&mut self, ui: &mut Ui, cell: &CellInfo) {
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

/// Consumes a pending nearest-row scroll only after that indexed row exists.
///
/// Nearest-position responses can arrive before the indexed search table has loaded
/// enough rows to make the target valid. In that case this leaves the pending value
/// in place so a later frame can still apply the scroll once the row is ready.
fn take_ready_nearest_row(
    scroll_nearest_pos: &mut Option<NearestPosition>,
    indexed_count: u64,
) -> Option<u64> {
    let row = scroll_nearest_pos.as_ref()?.index;
    if row >= indexed_count {
        return None;
    }

    scroll_nearest_pos.take().map(|pos| pos.index)
}

#[cfg(test)]
mod tests {
    use stypes::NearestPosition;

    use super::take_ready_nearest_row;

    #[test]
    fn keep_pending_scroll_until_ready() {
        let mut pending = Some(NearestPosition {
            index: 4,
            position: 40,
        });

        assert_eq!(take_ready_nearest_row(&mut pending, 4), None);
        assert_eq!(pending.as_ref().map(|pos| pos.index), Some(4));
    }

    #[test]
    fn consume_pending_scroll_when_ready() {
        let mut pending = Some(NearestPosition {
            index: 4,
            position: 40,
        });

        assert_eq!(take_ready_nearest_row(&mut pending, 5), Some(4));
        assert!(pending.is_none());
    }
}
