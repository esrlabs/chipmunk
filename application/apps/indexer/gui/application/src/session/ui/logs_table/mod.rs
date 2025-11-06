use std::ops::Range;

use egui::{Color32, Frame, Id, Margin, RichText, Ui};
use egui_table::{AutoSizeMode, CellInfo, Column, HeaderCellInfo, PrefetchInfo, TableDelegate};
use processor::grabber::LineRange;
use tokio::sync::{mpsc, oneshot};

use crate::session::{
    command::SessionBlockingCommand,
    communication::UiSenders,
    data::{LogMainIndex, SessionState},
};

use logs_mapped::LogsMapped;

mod logs_mapped;

#[derive(Debug, Default)]
pub struct LogsTable {
    last_visible_rows: Range<u64>,
    logs: LogsMapped,
}

impl LogsTable {
    pub fn render_content(&mut self, data: &SessionState, senders: &UiSenders, ui: &mut Ui) {
        let id_salt = Id::new("logs_table");

        let table = egui_table::Table::new()
            .id_salt(id_salt)
            .num_rows(data.logs_count)
            .columns(Self::text_columns())
            .auto_size_mode(AutoSizeMode::Never)
            .num_sticky_cols(1);

        let mut delegate = LogsDelegate {
            session_data: data,
            table: self,
            block_cmd_rx: &senders.block_cmd_tx,
        };

        table.show(ui, &mut delegate);
    }

    fn text_columns() -> Vec<Column> {
        vec![
            Column::new(100.0).range(50.0..=500.0).resizable(true),
            Column::default(),
        ]
    }
}

struct LogsDelegate<'a> {
    session_data: &'a SessionState,
    table: &'a mut LogsTable,
    block_cmd_rx: &'a mpsc::Sender<SessionBlockingCommand>,
}

impl TableDelegate for LogsDelegate<'_> {
    fn prepare(&mut self, info: &PrefetchInfo) {
        let PrefetchInfo { visible_rows, .. } = info;

        if self.table.last_visible_rows == *visible_rows {
            return;
        }

        self.table.last_visible_rows = info.visible_rows.to_owned();

        let range = LineRange::from(visible_rows.start..=visible_rows.end.saturating_sub(1));

        let (elems_tx, elems_rx) = oneshot::channel();
        let cmd = SessionBlockingCommand::GrabLines {
            range,
            sender: elems_tx,
        };

        if self.block_cmd_rx.blocking_send(cmd).is_err() {
            log::warn!("Communication error while sending grab commmand.");
            return;
        };

        if let Ok(elements) = elems_rx.blocking_recv() {
            self.table.logs.append(elements);
        }
    }

    fn header_cell_ui(&mut self, ui: &mut Ui, cell: &HeaderCellInfo) {
        Frame::NONE
            .inner_margin(Margin::symmetric(4, 0))
            .show(ui, |ui| {
                let header = match cell.group_index {
                    0 => "Nr.",
                    1 => "Log",
                    invalid => panic!("Invalid header index {invalid}"),
                };
                ui.label(header);
            });
    }

    fn cell_ui(&mut self, ui: &mut egui::Ui, cell: &egui_table::CellInfo) {
        let &CellInfo { col_nr, row_nr, .. } = cell;

        let highlight_match = col_nr != 0
            && self
                .session_data
                .search
                .current_matches_map()
                .is_some_and(|map| map.contains_key(&LogMainIndex(row_nr)));

        if highlight_match {
            ui.painter()
                .rect_filled(ui.max_rect(), 0.0, egui::Color32::DARK_GRAY);
        }

        Frame::NONE
            .inner_margin(Margin::symmetric(4, 0))
            .show(ui, |ui| match col_nr {
                0 => {
                    ui.label(row_nr.to_string());
                }
                1 => {
                    let content = self.table.logs.get_log(&row_nr).unwrap_or("Loading...");

                    if highlight_match {
                        let content = RichText::new(content).color(Color32::WHITE).strong();
                        ui.label(content);
                    } else {
                        ui.label(content);
                    }
                }
                invalid => panic!("Invalid column number. {invalid}"),
            });
    }
}
