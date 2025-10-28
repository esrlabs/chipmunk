use egui::{Frame, Id, Label, Margin, Ui};
use egui_table::{CellInfo, Column, HeaderCellInfo, TableDelegate};

use crate::{host::ui::UiActions, session::data::SessionState};

pub struct LogsTable;

impl LogsTable {
    pub fn render_content(data: &SessionState, ui: &mut Ui, _actions: &mut UiActions) {
        let id_salt = Id::new("logs_table");

        let table = egui_table::Table::new()
            .id_salt(id_salt)
            .num_rows(data.main_table.logs_window.len() as u64)
            .columns(Self::text_columns())
            .num_sticky_cols(1);

        let mut delegate = LogsDelegate { session_data: data };

        table.show(ui, &mut delegate);
    }

    fn text_columns() -> Vec<Column> {
        vec![
            Column::new(100.0).range(50.0..=500.0).resizable(true),
            Column::new(600.0).range(10.0..=1000.0).resizable(true),
        ]
    }
}

struct LogsDelegate<'a> {
    session_data: &'a SessionState,
}

impl TableDelegate for LogsDelegate<'_> {
    fn prepare(&mut self, _info: &egui_table::PrefetchInfo) {
        //TODO: I need to check here if the data is already available
    }

    fn header_cell_ui(&mut self, ui: &mut Ui, cell: &HeaderCellInfo) {
        Frame::NONE
            .inner_margin(Margin::symmetric(4, 0))
            .show(ui, |ui| {
                let label = Label::new(format!("{cell:?}")).truncate();
                ui.add(label);
            });
    }

    fn cell_ui(&mut self, ui: &mut egui::Ui, cell: &egui_table::CellInfo) {
        let &CellInfo { col_nr, row_nr, .. } = cell;
        Frame::NONE
            .inner_margin(Margin::symmetric(4, 0))
            .show(ui, |ui| {
                if col_nr == 0 {
                    ui.label(format!("{}", row_nr + 1));
                } else {
                    ui.label(self.session_data.main_table.logs_window[row_nr as usize].as_str());
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
