//TODO AAZ: This is duplicated from LogsTable.
//We need to have it in one place and encapsulate the changes.
use std::ops::Range;

use egui::{Color32, Frame, Id, Label, Margin, RichText, Ui, Widget};
use egui_table::{AutoSizeMode, CellInfo, Column, PrefetchInfo, TableDelegate};
use tokio::sync::{mpsc::Sender, oneshot};

use crate::{
    host::ui::UiActions,
    session::{
        command::{SessionBlockingCommand, SessionCommand},
        data::SessionDataState,
        ui::state::SessionUiState,
    },
};

use super::indexed_mapped::{IndexedMapped, SearchTableIndex};

#[derive(Debug)]
pub struct SearchTable {
    cmd_tx: Sender<SessionCommand>,
    block_cmd_tx: Sender<SessionBlockingCommand>,
    last_visible_rows: Option<Range<u64>>,
    indexed_logs: IndexedMapped,
}

impl SearchTable {
    pub fn new(
        cmd_tx: Sender<SessionCommand>,
        block_cmd_tx: Sender<SessionBlockingCommand>,
    ) -> Self {
        Self {
            cmd_tx,
            block_cmd_tx,
            last_visible_rows: None,
            indexed_logs: IndexedMapped::default(),
        }
    }

    pub fn render_content(
        &mut self,
        data: &SessionDataState,
        ui_state: &mut SessionUiState,
        actions: &mut UiActions,
        ui: &mut Ui,
    ) {
        let id_salt = Id::new("search_table");

        let mut table = egui_table::Table::new()
            .id_salt(id_salt)
            .num_rows(data.search.search_count)
            .headers(Vec::new())
            .columns(Self::text_columns())
            .auto_size_mode(AutoSizeMode::Never)
            .num_sticky_cols(1);

        if let Some(row_nr) = ui_state.scroll_search_idx.take()
            && row_nr < data.search.search_count
        {
            const OFFSET: u64 = 2;
            table = table.scroll_to_rows(row_nr.saturating_sub(OFFSET)..=row_nr + OFFSET, None);
        }

        let mut delegate = LogsDelegate {
            session_data: data,
            table: self,
            ui_state,
            actions,
        };

        table.show(ui, &mut delegate);
    }

    pub fn clear(&mut self) {
        let Self {
            cmd_tx: _,
            block_cmd_tx: _,
            last_visible_rows,
            indexed_logs,
        } = self;

        if last_visible_rows.is_some() {
            *last_visible_rows = None;
            indexed_logs.clear();
        }
    }

    fn text_columns() -> Vec<Column> {
        vec![
            Column::new(100.0).range(50.0..=500.0).resizable(true),
            Column::default(),
        ]
    }
}

struct LogsDelegate<'a> {
    session_data: &'a SessionDataState,
    table: &'a mut SearchTable,
    ui_state: &'a mut SessionUiState,
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

        if self.session_data.search.search_count == 0 {
            return;
        }

        let rng = visible_rows.start..=visible_rows.end.saturating_sub(1);

        let (elems_tx, elems_rx) = oneshot::channel();
        let cmd = SessionBlockingCommand::GrabIndexedLines {
            range: rng.clone(),
            sender: elems_tx,
        };

        if self.table.block_cmd_tx.blocking_send(cmd).is_err() {
            log::error!("Communication error while sending grab commmand.");
            return;
        }

        if let Ok(elements) = elems_rx.blocking_recv() {
            let combined = rng.map(SearchTableIndex).zip(elements);
            self.table.indexed_logs.append(combined);
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
                    .session_data
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
                            let selected_pos = if is_selected {
                                None
                            } else {
                                Some(log_item.pos as u64)
                            };

                            self.ui_state.scroll_main_row = selected_pos;

                            self.actions.try_send_command(
                                &self.table.cmd_tx,
                                SessionCommand::SetSelectedLog(selected_pos),
                            );
                        }
                    }
                    invalid => panic!("Invalid column number. {invalid}"),
                }
            });
    }
}
