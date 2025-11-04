//TODO AAZ: This is duplicated from LogsTable.
//We need to have it in one place and encapsulate the changes.
use std::{
    borrow::Cow,
    ops::{Range, RangeInclusive},
};

use egui::{Frame, Id, Margin, Ui};
use egui_table::{AutoSizeMode, CellInfo, Column, PrefetchInfo, TableDelegate};

use crate::session::{
    command::SessionCommand,
    communication::UiSenders,
    data::{SearchTableIndex, SessionState},
};

const LOGS_WINDOW_OFFSET: u64 = 5;

#[derive(Debug, Default)]
pub struct SearchTable {
    last_visible_rows: Range<u64>,
}

impl SearchTable {
    pub fn render_content(&mut self, data: &SessionState, senders: &UiSenders, ui: &mut Ui) {
        let id_salt = Id::new("search_table");

        let table = egui_table::Table::new()
            .id_salt(id_salt)
            .num_rows(data.search.search_count)
            .headers(Vec::new())
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
            let cmd = SessionCommand::GrabIndexedLines(to_fetch);
            if senders.cmd_tx.try_send(cmd).is_err() {
                log::warn!(
                    "Search table viewer is sending grab commands too fast for channel capacity"
                );
            }

            // Request discard this frame and start a new one with the fetched data.
            //
            // NOTE: We need to request discard when users are dragging the scrollbar.
            // Avoiding this extra checks cause errors while resizing the application
            // main window.
            //
            // TODO AAZ: This is an extra check that should be not needed.
            if !ui.ctx().will_discard() && ui.ctx().is_using_pointer() {
                ui.ctx().request_discard("Fetch search table new rows");
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
    to_fetch: Option<RangeInclusive<u64>>,
    last_visible_rows: &'a mut Range<u64>,
}

impl TableDelegate for LogsDelegate<'_> {
    fn prepare(&mut self, info: &PrefetchInfo) {
        let PrefetchInfo { visible_rows, .. } = info;

        self.to_fetch = if self.last_visible_rows == visible_rows {
            None
        } else {
            *self.last_visible_rows = info.visible_rows.to_owned();

            let start = visible_rows.start.saturating_sub(LOGS_WINDOW_OFFSET);
            let end =
                (visible_rows.end + LOGS_WINDOW_OFFSET).min(self.session_data.search.search_count);

            let rng = start..=end.saturating_sub(1);

            Some(rng)
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
                let content: Cow<'_, str> = if let Some(element) = self
                    .session_data
                    .search
                    .search_table
                    .get_element(&SearchTableIndex(row_nr))
                {
                    match col_nr {
                        0 => element.pos.to_string().into(),
                        1 => element.content.as_str().into(),
                        invalid => panic!("Invalid column number. {invalid}"),
                    }
                } else if self.to_fetch.is_some() {
                    "".into()
                } else {
                    "Loading...".into()
                };

                ui.label(content);
            });
    }
}
