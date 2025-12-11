//TODO AAZ: This is duplicated from LogsTable.
//We need to have it in one place and encapsulate the changes.
use std::{ops::Range, rc::Rc, sync::mpsc::Receiver as StdReceiver, time::Duration};

use egui::{Color32, Frame, Id, Label, Margin, RichText, Ui, Widget};
use egui_table::{AutoSizeMode, CellInfo, Column, PrefetchInfo, TableDelegate};
use stypes::{GrabbedElement, NearestPosition};
use tokio::sync::mpsc::Sender;

use crate::{
    host::{notification::AppNotification, ui::UiActions},
    session::{
        command::SessionCommand,
        error::SessionError,
        ui::{definitions::schema::LogSchema, shared::SessionShared},
    },
};

use super::indexed_mapped::{IndexedMapped, SearchTableIndex};

const TIMEOUT_DURATION: Duration = Duration::from_millis(50);
const SEND_INTERVAL: Duration = Duration::from_millis(5);
const SEND_RETRY_MAX_COUNT: u8 = 10;

#[derive(Debug)]
pub struct SearchTable {
    cmd_tx: Sender<SessionCommand>,
    last_visible_rows: Option<Range<u64>>,
    indexed_logs: IndexedMapped,
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
        let mut cols = Vec::with_capacity(schema.columns().len() + 1);
        let nums_col = Column::new(100.0).range(50.0..=500.0).resizable(true);

        cols.push(nums_col);
        cols.extend(schema.columns().iter().map(|col| col.column));

        Self {
            cmd_tx,
            last_visible_rows: None,
            indexed_logs: IndexedMapped::new(schema),
            pending_logs_rx: None,
            scroll_nearest_pos: None,
            columns: cols.into_boxed_slice(),
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
        let id_salt = Id::new("search_table");

        let mut table = egui_table::Table::new()
            .id_salt(id_salt)
            .num_rows(shared.search.total_count)
            .headers(Vec::new())
            .columns(self.columns.as_ref())
            .auto_size_mode(AutoSizeMode::Never)
            .num_sticky_cols(1);

        if let Some(row_nr) = self.scroll_nearest_pos.take().map(|pos| pos.index)
            && row_nr < shared.search.total_count
        {
            const OFFSET: u64 = 2;
            table = table.scroll_to_rows(row_nr.saturating_sub(OFFSET)..=row_nr + OFFSET, None);
        }

        let mut delegate = LogsDelegate {
            shared,
            table: self,
            actions,
            request_repaint: false,
        };

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

struct LogsDelegate<'a> {
    table: &'a mut SearchTable,
    shared: &'a mut SessionShared,
    actions: &'a mut UiActions,
    request_repaint: bool,
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

            if self.shared.search.total_count == 0 {
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
                SEND_INTERVAL,
                SEND_RETRY_MAX_COUNT,
            ) {
                return;
            }

            elems_rx
        };

        if let Ok(elements) = logs_rx.recv_timeout(TIMEOUT_DURATION) {
            match elements {
                Ok(elements) => {
                    let combined = rng.map(SearchTableIndex).zip(elements);
                    self.table.indexed_logs.append(combined);
                }
                Err(error) => {
                    let session_id = self.shared.get_id();
                    log::error!("Session Error: Session ID: {session_id}, error: {error}");

                    let notifi = AppNotification::SessionError { session_id, error };

                    self.actions.add_notification(notifi);
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

    fn cell_ui(&mut self, ui: &mut Ui, cell: &CellInfo) {
        let &CellInfo { col_nr, row_nr, .. } = cell;

        let log_item = self
            .table
            .indexed_logs
            .get_log_item(&SearchTableIndex(row_nr));

        let is_selected = self
            .shared
            .logs
            .selected_log
            .as_ref()
            .is_some_and(|selected| {
                log_item
                    .as_ref()
                    .is_some_and(|i| selected.pos == i.element.pos)
            });

        if is_selected {
            ui.painter()
                .rect_filled(ui.max_rect(), 0.0, Color32::DARK_GREEN);
        }

        Frame::NONE
            .inner_margin(Margin::symmetric(4, 0))
            .show(ui, |ui| {
                let log_item = match log_item {
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

                match col_nr {
                    0 => {
                        ui.label(log_item.element.pos.to_string());
                    }
                    _ => {
                        let content = log_item
                            .column_ranges
                            .get(col_nr.saturating_sub(1))
                            .and_then(|rng| log_item.element.content.get(rng.clone()))
                            .unwrap_or_default();
                        let label = if is_selected {
                            let content = RichText::new(content).color(Color32::WHITE).strong();
                            Label::new(content)
                        } else {
                            Label::new(content)
                        };

                        if label.ui(ui).clicked() {
                            if is_selected {
                                self.shared.logs.selected_log = None;
                            } else {
                                let pos = log_item.element.pos as u64;

                                self.shared.logs.scroll_main_row = Some(pos);

                                self.actions.try_send_command(
                                    &self.table.cmd_tx,
                                    SessionCommand::GetSelectedLog(pos),
                                );
                            };
                        }
                    }
                }
            });
    }
}
