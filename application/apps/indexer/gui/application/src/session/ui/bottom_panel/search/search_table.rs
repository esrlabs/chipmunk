//TODO AAZ: This is duplicated from LogsTable.
//We need to have it in one place and encapsulate the changes.
use std::ops::Range;

use egui::{Color32, Frame, Id, Label, Margin, RichText, Ui, Widget};
use egui_table::{AutoSizeMode, CellInfo, Column, PrefetchInfo, TableDelegate};
use stypes::NearestPosition;
use tokio::sync::{mpsc::Sender, oneshot};

use crate::{
    host::{notification::AppNotification, ui::UiActions},
    session::{command::SessionCommand, ui::shared::SessionShared},
};

use super::indexed_mapped::{IndexedMapped, SearchTableIndex};

#[derive(Debug)]
pub struct SearchTable {
    cmd_tx: Sender<SessionCommand>,
    last_visible_rows: Option<Range<u64>>,
    indexed_logs: IndexedMapped,
    /// The index of the log in search table to make the table scroll
    /// toward this index.
    scroll_nearest_pos: Option<NearestPosition>,
}

impl SearchTable {
    pub fn new(cmd_tx: Sender<SessionCommand>) -> Self {
        Self {
            cmd_tx,
            last_visible_rows: None,
            indexed_logs: IndexedMapped::default(),
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
        let id_salt = Id::new("search_table");

        let mut table = egui_table::Table::new()
            .id_salt(id_salt)
            .num_rows(shared.search.total_count)
            .headers(Vec::new())
            .columns(Self::text_columns())
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
        };

        table.show(ui, &mut delegate);
    }

    pub fn clear(&mut self) {
        let Self {
            cmd_tx: _,
            last_visible_rows,
            indexed_logs,
            scroll_nearest_pos,
        } = self;

        *last_visible_rows = None;
        indexed_logs.clear();
        *scroll_nearest_pos = None;
    }

    fn text_columns() -> Vec<Column> {
        vec![
            Column::new(100.0).range(50.0..=500.0).resizable(true),
            Column::default(),
        ]
    }
}

struct LogsDelegate<'a> {
    table: &'a mut SearchTable,
    shared: &'a mut SessionShared,
    actions: &'a mut UiActions,
}

impl TableDelegate for LogsDelegate<'_> {
    fn prepare(&mut self, info: &PrefetchInfo) {
        let PrefetchInfo { visible_rows, .. } = info;

        if self
            .table
            .last_visible_rows
            .as_ref()
            .is_some_and(|v| v == visible_rows)
        {
            return;
        }

        self.table.last_visible_rows = Some(info.visible_rows.to_owned());

        if self.shared.search.total_count == 0 {
            return;
        }

        let rng = visible_rows.start..=visible_rows.end.saturating_sub(1);

        let (elems_tx, elems_rx) = oneshot::channel();
        let cmd = SessionCommand::GrabIndexedLinesBlocking {
            range: rng.clone(),
            sender: elems_tx,
        };

        if self.table.cmd_tx.blocking_send(cmd).is_err() {
            log::error!("Communication error while sending grab commmand.");
            return;
        }

        if let Ok(elements) = elems_rx.blocking_recv() {
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
        }
    }

    fn header_cell_ui(&mut self, _ui: &mut Ui, _cell: &egui_table::HeaderCellInfo) {
        panic!("search table doesn't have headers");
    }

    fn cell_ui(&mut self, ui: &mut Ui, cell: &CellInfo) {
        let &CellInfo { col_nr, row_nr, .. } = cell;

        Frame::NONE
            .inner_margin(Margin::symmetric(4, 0))
            .show(ui, |ui| {
                let log_item = match self
                    .table
                    .indexed_logs
                    .get_element(&SearchTableIndex(row_nr))
                {
                    Some(log) => log,
                    None => {
                        ui.label("Loading...");
                        return;
                    }
                };

                let is_selected = self
                    .shared
                    .logs
                    .selected_log
                    .as_ref()
                    .is_some_and(|e| e.pos == log_item.pos);

                if is_selected {
                    ui.painter()
                        .rect_filled(ui.max_rect(), 0.0, egui::Color32::DARK_GREEN);
                }

                match col_nr {
                    0 => {
                        ui.label(log_item.pos.to_string());
                    }
                    1 => {
                        let label = if is_selected {
                            let content = RichText::new(&log_item.content)
                                .color(Color32::WHITE)
                                .strong();
                            Label::new(content)
                        } else {
                            Label::new(&log_item.content)
                        };

                        if label.ui(ui).clicked() {
                            if is_selected {
                                self.shared.logs.selected_log = None;
                            } else {
                                let pos = log_item.pos as u64;

                                self.shared.logs.scroll_main_row = Some(pos);

                                self.actions.try_send_command(
                                    &self.table.cmd_tx,
                                    SessionCommand::GetSelectedLog(pos),
                                );
                            };
                        }
                    }
                    invalid => panic!("Invalid column number. {invalid}"),
                }
            });
    }
}
