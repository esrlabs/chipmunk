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
            to_fetch: None,
        };

        table.show(ui, &mut delegate);

        if let Some(to_fetch) = delegate.to_fetch {
            let cmd = SessionCommand::GrabLines(to_fetch);
            //TODO AAZ: Handle errors.
            if senders.cmd_tx.try_send(cmd).is_err() {
                println!("*** Sending grab commands too fast ***");
            };

            //TODO AAZ: Add UI action to wait until state is changed.
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
}

impl TableDelegate for LogsDelegate<'_> {
    fn prepare(&mut self, info: &egui_table::PrefetchInfo) {
        self.to_fetch = self
            .session_data
            .main_table
            .check_fetch(&info.visible_rows, self.session_data.logs_count)
            .map(LineRange::from);
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
                    let content = self
                        .session_data
                        .main_table
                        .get_log(row_nr)
                        .unwrap_or("Loading...");

                    ui.label(content);
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
