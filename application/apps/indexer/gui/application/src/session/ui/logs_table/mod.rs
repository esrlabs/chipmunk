use std::ops::Range;

use egui::{Frame, Id, Margin, Ui};
use egui_table::{AutoSizeMode, CellInfo, Column, HeaderCellInfo, PrefetchInfo, TableDelegate};
use processor::grabber::LineRange;

use crate::session::{command::SessionCommand, communication::UiSenders, data::SessionState};

const LOGS_WINDOW_OFFSET: u64 = 5;

#[derive(Debug, Default)]
pub struct LogsTable {
    last_visible_rows: Range<u64>,
}

impl LogsTable {
    pub fn render_content(&mut self, data: &SessionState, senders: &UiSenders, ui: &mut Ui) {
        let id_salt = Id::new("logs_table");

        let table = egui_table::Table::new()
            .id_salt(id_salt)
            .num_rows(data.logs_count as u64)
            .columns(Self::text_columns())
            .auto_size_mode(AutoSizeMode::Never)
            .num_sticky_cols(1);

        let mut delegate = LogsDelegate {
            session_data: data,
            to_fetch: None,
            last_visible_rows: &mut self.last_visible_rows,
        };

        table.show(ui, &mut delegate);

        if let Some(to_fetch) = delegate.to_fetch.take() {
            let cmd = SessionCommand::GrabLines(to_fetch);
            if senders.cmd_tx.try_send(cmd).is_err() {
                log::warn!("Logs viewer is sending grab commands too fast for channel capacity");
            };

            // Request discard this frame and start a new one with the fetched data.
            //
            // NOTE: We need to request discard when users are dragging the scrollbar.
            // Avoiding this extra checks cause errors while resizing the application
            // main window.
            //
            // TODO AAZ: This is an extra check that should be not needed.
            // && (ui.ctx().is_pointer_over_area() || ui.ctx().is_using_pointer())
            if !ui.ctx().will_discard() && ui.ctx().is_using_pointer() {
                ui.ctx().request_discard("Fetching new rows");
            }
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
    session_data: &'a SessionState,
    to_fetch: Option<LineRange>,
    last_visible_rows: &'a mut Range<u64>,
}

impl TableDelegate for LogsDelegate<'_> {
    fn prepare(&mut self, info: &PrefetchInfo) {
        // Check if we need the columns has changed from last frame
        // and set the needed range to fetch if so.
        let PrefetchInfo { visible_rows, .. } = info;
        self.to_fetch = if self.last_visible_rows == visible_rows {
            None
        } else {
            *self.last_visible_rows = info.visible_rows.to_owned();

            let start = visible_rows.start.saturating_sub(LOGS_WINDOW_OFFSET);
            let end = (visible_rows.end + LOGS_WINDOW_OFFSET).min(self.session_data.logs_count);

            let rng = LineRange::from(start..=end.saturating_sub(1));
            Some(rng)
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

        Frame::NONE
            .inner_margin(Margin::symmetric(4, 0))
            .show(ui, |ui| match col_nr {
                0 => {
                    ui.label(format!("{}", row_nr));
                }
                1 => {
                    let content =
                        self.session_data
                            .main_table
                            .get_log(row_nr)
                            .unwrap_or_else(|| {
                                // Avoid showing place holder text in this frame since it will be
                                // discarded to fetch new data.
                                if self.to_fetch.is_some() {
                                    ""
                                } else {
                                    "Loading..."
                                }
                            });

                    ui.label(content);
                }
                invalid => panic!("Invalid column number. {invalid}"),
            });
    }
}
