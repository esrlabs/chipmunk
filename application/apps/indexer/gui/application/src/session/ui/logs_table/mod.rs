use std::ops::Range;

use egui::{Color32, Frame, Id, Label, Margin, RichText, Ui, Widget};
use egui_table::{AutoSizeMode, CellInfo, Column, HeaderCellInfo, PrefetchInfo, TableDelegate};
use processor::grabber::LineRange;
use tokio::sync::{mpsc, oneshot};

use crate::{
    host::ui::UiActions,
    session::{
        command::{SessionBlockingCommand, SessionCommand},
        communication::UiSenders,
        data::{LogMainIndex, SessionDataState},
        ui::{bottom_panel::BottomTabType, state::SessionUiState},
    },
};

use logs_mapped::LogsMapped;

mod logs_mapped;

#[derive(Debug, Default)]
pub struct LogsTable {
    last_visible_rows: Range<u64>,
    logs: LogsMapped,
}

impl LogsTable {
    pub fn render_content(
        &mut self,
        data: &SessionDataState,
        ui_state: &mut SessionUiState,
        senders: &UiSenders,
        actions: &mut UiActions,
        ui: &mut Ui,
    ) {
        let id_salt = Id::new("logs_table");

        let mut table = egui_table::Table::new()
            .id_salt(id_salt)
            .num_rows(data.logs_count)
            .columns(Self::text_columns())
            .auto_size_mode(AutoSizeMode::Never)
            .num_sticky_cols(1);

        if let Some(row) = ui_state.scroll_main_row.take() {
            table = table.scroll_to_row(row, None);
        }

        let mut delegate = LogsDelegate {
            session_data: data,
            table: self,
            block_cmd_tx: &senders.block_cmd_tx,
            ui_state,
            senders,
            actions,
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
    session_data: &'a SessionDataState,
    table: &'a mut LogsTable,
    block_cmd_tx: &'a mpsc::Sender<SessionBlockingCommand>,
    ui_state: &'a mut SessionUiState,
    senders: &'a UiSenders,
    actions: &'a mut UiActions,
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

        if self.block_cmd_tx.blocking_send(cmd).is_err() {
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

        let is_selected = self
            .session_data
            .selected_log
            .as_ref()
            .is_some_and(|e| e.pos == row_nr as usize);

        let mut invert_fg = is_selected;
        if is_selected {
            ui.painter()
                .rect_filled(ui.max_rect(), 0.0, egui::Color32::DARK_GREEN);
        } else {
            let highlight_match = col_nr != 0
                && self
                    .session_data
                    .search
                    .current_matches_map()
                    .is_some_and(|map| map.contains_key(&LogMainIndex(row_nr)));

            if highlight_match {
                invert_fg = true;
                ui.painter()
                    .rect_filled(ui.max_rect(), 0.0, egui::Color32::DARK_GRAY);
            }
        }

        Frame::NONE
            .inner_margin(Margin::symmetric(4, 0))
            .show(ui, |ui| match col_nr {
                0 => {
                    ui.label(row_nr.to_string());
                }
                1 => {
                    let content = self.table.logs.get_log(&row_nr).unwrap_or("Loading...");

                    let label = if invert_fg {
                        let content = RichText::new(content).color(Color32::WHITE).strong();
                        Label::new(content)
                    } else {
                        Label::new(content)
                    };

                    if label.ui(ui).clicked() {
                        let selected_pos = if is_selected {
                            None
                        } else {
                            // Scroll to log in search if it's active only.
                            if self.ui_state.bottom_panel.active_tab == BottomTabType::Search {
                                let nearest_cmd = SessionCommand::GetNearestPosition(row_nr);
                                self.actions
                                    .try_send_command(&self.senders.cmd_tx, nearest_cmd);
                            }
                            Some(row_nr)
                        };

                        self.actions.try_send_command(
                            &self.senders.cmd_tx,
                            SessionCommand::SetSelectedLog(selected_pos),
                        );
                    }
                }
                invalid => panic!("Invalid column number. {invalid}"),
            });
    }
}
