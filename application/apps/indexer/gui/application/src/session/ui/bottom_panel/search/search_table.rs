use std::{ops::Range, rc::Rc, sync::mpsc::Receiver as StdReceiver};

use egui::{Sense, Ui};
use egui_table::{CellInfo, Column, PrefetchInfo, TableDelegate};
use stypes::{GrabbedElement, NearestPosition};
use tokio::sync::mpsc::Sender;

use crate::{
    host::ui::UiActions,
    session::{
        command::SessionCommand,
        error::SessionError,
        ui::{
            common::{
                self,
                logs_mapped::LogsMapped,
                logs_tables::{grab_cmd_consts, should_stick_to_bottom},
            },
            definitions::{LogTableItem, schema::LogSchema},
            shared::SessionShared,
        },
    },
};

#[derive(Debug)]
pub struct SearchTable {
    cmd_tx: Sender<SessionCommand>,
    last_visible_rows: Option<Range<u64>>,
    indexed_logs: LogsMapped,
    /// Logs receiver from previous frame if receive function timed out
    /// on that frame.
    pending_logs_rx: Option<StdReceiver<Result<Vec<GrabbedElement>, SessionError>>>,
    /// The index of the log in search table to make the table scroll
    /// toward this index.
    scroll_nearest_pos: Option<NearestPosition>,
    columns: Box<[Column]>,
}

impl SearchTable {
    pub fn new(cmd_tx: Sender<SessionCommand>, schema: Rc<dyn LogSchema>) -> Self {
        let columns = common::logs_tables::create_table_columns(schema.as_ref());

        Self {
            cmd_tx,
            last_visible_rows: None,
            indexed_logs: LogsMapped::new(schema),
            pending_logs_rx: None,
            scroll_nearest_pos: None,
            columns,
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
        let mut table = egui_table::Table::new()
            .id_salt("search_table")
            .num_rows(shared.search.indexed_result_count())
            .headers(Vec::new())
            .columns(self.columns.as_ref())
            .num_sticky_cols(1)
            .stick_to_bottom(should_stick_to_bottom(shared));

        if let Some(row_nr) = self.scroll_nearest_pos.take().map(|pos| pos.index)
            && row_nr < shared.search.indexed_result_count()
        {
            const OFFSET: u64 = 2;
            table = table.scroll_to_rows(row_nr.saturating_sub(OFFSET)..=row_nr + OFFSET, None);
        }

        let mut delegate = LogsDelegate::new(self, shared, actions);
        table.show(ui, &mut delegate);

        if delegate.request_repaint {
            ui.ctx().request_repaint();
        }
    }

    pub fn clear(&mut self) {
        let Self {
            cmd_tx: _,
            last_visible_rows,
            indexed_logs,
            pending_logs_rx,
            scroll_nearest_pos,
            columns: _,
        } = self;

        *last_visible_rows = None;
        indexed_logs.clear();
        *scroll_nearest_pos = None;
        *pending_logs_rx = None;
    }
}

#[derive(Debug)]
struct LogsDelegate<'a> {
    table: &'a mut SearchTable,
    shared: &'a mut SessionShared,
    actions: &'a mut UiActions,
    request_repaint: bool,
    has_multi_sources: bool,
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
        }
    }

    #[inline(always)]
    fn is_row_selected(&self, log_item: Option<&LogTableItem>) -> bool {
        self.shared
            .logs
            .selected_log
            .as_ref()
            .is_some_and(|selected| {
                log_item
                    .as_ref()
                    .is_some_and(|i| selected.pos == i.element.pos)
            })
    }

    /// Toggle if row is selected sending the needed commands when row is selected.
    ///
    /// # Arguments
    ///
    /// * `pos`: Row position in original stream.
    /// * `currently_selected`: Is raw currently selected before toggling.
    fn toggle_row_selected(&mut self, pos: u64, currently_selected: bool) {
        if currently_selected {
            self.shared.logs.selected_log = None;
        } else {
            self.shared.logs.scroll_main_row = Some(pos);

            self.actions
                .try_send_command(&self.table.cmd_tx, SessionCommand::GetSelectedLog(pos));
        };
    }

    fn toggle_row_bookmark(&mut self, pos: u64) {
        let cmd = if self.shared.logs.is_bookmarked(pos) {
            SessionCommand::RemoveBookmark(pos)
        } else {
            SessionCommand::AddBookmark(pos)
        };
        self.actions.try_send_command(&self.table.cmd_tx, cmd);
    }

    fn get_log_item(&self, cell: &CellInfo) -> Option<&LogTableItem> {
        self.table.indexed_logs.get_log_item(&cell.row_nr)
    }

    fn render_row_header(&mut self, ui: &mut Ui, cell: &CellInfo) {
        let (text, color_idx) = self
            .get_log_item(cell)
            .map(|item| {
                (
                    item.element.pos.to_string(),
                    self.has_multi_sources
                        .then_some(item.element.source_id as usize),
                )
            })
            .unwrap_or_default();
        let is_bookmarked = self
            .get_log_item(cell)
            .is_some_and(|item| self.shared.logs.is_bookmarked(item.element.pos as u64));

        let bookmark_pos = self.get_log_item(cell).map(|item| item.element.pos as u64);
        common::logs_tables::render_row_header(ui, text, color_idx, is_bookmarked, || {
            if let Some(bookmark_pos) = bookmark_pos {
                self.toggle_row_bookmark(bookmark_pos);
            }
        });
    }

    fn render_log_cell(&mut self, ui: &mut Ui, cell: &CellInfo) {
        let mut source_changed = false;

        common::logs_tables::get_cell_frame().show(ui, |ui| {
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

            let content = log_item
                .column_ranges
                .get(cell.col_nr.saturating_sub(1))
                .and_then(|rng| log_item.element.content.get(rng.to_owned()))
                .unwrap_or_default();

            let response = match common::logs_tables::highlighted_cell_layout_job(
                ui,
                content,
                log_item.element.pos as u64,
                self.shared,
                self.shared.search.compiled_filters(),
            ) {
                Some(job) => ui.label(job),
                None => ui.label(content),
            };

            if response.clicked() {
                let is_selected = self.is_row_selected(Some(log_item));
                self.toggle_row_selected(log_item.element.pos as u64, is_selected);
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

            if self.shared.search.indexed_result_count() == 0 {
                return;
            }

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
                    common::logs_tables::handle_grab_errors(
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
        common::logs_tables::apply_log_row_colors(ui, self.shared, main_log_pos, is_selected);

        if ui.response().interact(Sense::click()).clicked()
            && let Some(log_item) = log_item
        {
            self.toggle_row_selected(log_item.element.pos as u64, is_selected);
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
