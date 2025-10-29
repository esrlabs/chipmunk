use egui::{Frame, Id, Margin, Ui};
use egui_table::{AutoSizeMode, CellInfo, Column, HeaderCellInfo, TableDelegate};
use processor::grabber::LineRange;

use crate::{
    host::ui::UiActions,
    session::{command::SessionCommand, communication::UiSenders, data::SessionState},
};

pub struct LogsTable;

impl LogsTable {
    pub fn render_content(
        data: &SessionState,
        senders: &UiSenders,
        ui: &mut Ui,
        _actions: &mut UiActions,
    ) {
        let id_salt = Id::new("logs_table");

        let table = egui_table::Table::new()
            .id_salt(id_salt)
            .num_rows(data.logs_count as u64)
            .columns(Self::text_columns())
            .auto_size_mode(AutoSizeMode::Never)
            .num_sticky_cols(1);

        let mut delegate = LogsDelegate {
            session_data: data,
            min_line: u64::MAX,
            max_line: u64::MIN,
        };

        table.show(ui, &mut delegate);

        let last_line = data.main_table.idx_offset + data.main_table.logs_window.len() as u64;

        let max = (delegate.max_line + 200).min(data.logs_count.saturating_sub(1));
        if data.logs_count != 0 && max >= last_line {
            let rng = last_line..=max;
            let cmd = SessionCommand::GrabLines(LineRange::from(rng));
            //TODO AAZ: Handle errors.
            if senders.cmd_tx.try_send(cmd).is_err() {
                println!("*** Sending grab commands too fast ***");
            };
        }
        //TODO: Add UI action to wait until state is changed.
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
    min_line: u64,
    max_line: u64,
}

impl TableDelegate for LogsDelegate<'_> {
    fn prepare(&mut self, _info: &egui_table::PrefetchInfo) {
        //TODO: I need to check here if the data is already available
        //TODO AAZ: Deal with max and min here.
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
        self.min_line = self.min_line.min(row_nr);
        self.max_line = self.max_line.max(row_nr);

        if row_nr % 2 == 1 {
            ui.painter()
                .rect_filled(ui.max_rect(), 0.0, ui.visuals().faint_bg_color);
        }

        Frame::NONE
            .inner_margin(Margin::symmetric(4, 0))
            .show(ui, |ui| {
                if col_nr == 0 {
                    ui.label(format!("{}", row_nr));
                } else {
                    let main_table = &self.session_data.main_table;
                    let rows_rng = main_table.idx_offset
                        ..(main_table.idx_offset + main_table.logs_window.len() as u64);
                    if rows_rng.contains(&row_nr) {
                        ui.label(
                            self.session_data.main_table.logs_window[row_nr as usize].as_str(),
                        );
                    } else {
                        ui.label("Loading...");
                    };
                }
            });
    }

    fn row_top_offset(&self, _ctx: &egui::Context, _table_id: egui::Id, row_nr: u64) -> f32 {
        row_nr as f32 * self.default_row_height()
    }

    fn default_row_height(&self) -> f32 {
        20.0
    }
}
