use std::{ops::Range, rc::Rc, time::Duration};

use egui::{Color32, Frame, Id, Label, Margin, Sense, TextBuffer, Ui, Widget};
use egui_table::{AutoSizeMode, CellInfo, Column, HeaderCellInfo, PrefetchInfo, TableDelegate};
use processor::grabber::LineRange;
use std::sync::mpsc::Receiver as StdReceiver;
use stypes::GrabbedElement;
use tokio::sync::mpsc::Sender;

use crate::{
    host::{notification::AppNotification, ui::UiActions},
    session::{
        command::SessionCommand,
        error::SessionError,
        ui::{
            bottom_panel::BottomTabType,
            definitions::schema::LogSchema,
            shared::{LogMainIndex, SessionShared},
        },
    },
};

use logs_mapped::LogsMapped;

mod logs_mapped;

const TIMEOUT_DURATION: Duration = Duration::from_millis(50);
const SEND_INTERVAL: Duration = Duration::from_millis(5);
const SEND_RETRY_MAX_COUNT: u8 = 10;

#[derive(Debug)]
pub struct LogsTable {
    logs: LogsMapped,
    last_visible_rows: Option<Range<u64>>,
    cmd_tx: Sender<SessionCommand>,
    /// Logs receiver from previous frame if receive function timed out
    /// on that frame.
    pending_logs_rx: Option<StdReceiver<Result<Vec<GrabbedElement>, SessionError>>>,
    schema: Rc<dyn LogSchema>,
    columns: Box<[Column]>,
}

impl LogsTable {
<<<<<<< HEAD
    pub fn new(cmd_tx: Sender<SessionCommand>, schema: Rc<dyn LogSchema>) -> Self {
        let mut columns = Vec::with_capacity(schema.columns().len() + 1);
        let nums_col = Column::new(100.0).range(50.0..=500.0).resizable(true);

        columns.push(nums_col);
        columns.extend(schema.columns().iter().map(|col| col.column));

        Self {
            cmd_tx,
            last_visible_rows: Default::default(),
            logs: LogsMapped::new(Rc::clone(&schema)),
            pending_logs_rx: None,
            schema,
            columns: columns.into_boxed_slice(),
        }
    }

    pub fn render_content(
        &mut self,
        shared: &mut SessionShared,
        actions: &mut UiActions,
        ui: &mut Ui,
    ) {
        let id_salt = Id::new("logs_table");

        let mut table = egui_table::Table::new()
            .id_salt(id_salt)
            .num_rows(shared.logs.logs_count)
            .columns(self.columns.as_ref())
            .auto_size_mode(AutoSizeMode::Never)
            .num_sticky_cols(1);

        if !self.schema.has_headers() {
            table = table.headers(Vec::new());
        }

        if let Some(row) = shared.logs.scroll_main_row.take() {
            const OFFSET: u64 = 3;
            table = table.scroll_to_rows(row.saturating_sub(OFFSET)..=(row + OFFSET), None);
        }

        let mut delegate = LogsDelegate {
            table: self,
            shared,
            actions,
            request_repaint: false,
        };

        table.show(ui, &mut delegate);

        if delegate.request_repaint {
            ui.ctx().request_repaint();
        }
=======
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
>>>>>>> e8b8dd3f7 (Integrating core session in native UI with text files (WIP))
    }
}

struct LogsDelegate<'a> {
<<<<<<< HEAD
    table: &'a mut LogsTable,
    shared: &'a mut SessionShared,
    actions: &'a mut UiActions,
    request_repaint: bool,
}

impl LogsDelegate<'_> {
    #[inline(always)]
    fn is_row_selected(&self, row_nr: u64) -> bool {
        self.shared
            .logs
            .selected_log
            .as_ref()
            .is_some_and(|e| e.pos == row_nr as usize)
    }

    /// Toggle if row is selected sending the needed commands when row is selected.
    ///
    /// # Arguments
    ///
    /// * `row_nr`: Row number.
    /// * `currently_selected`: Is raw currently selected before toggling.
    fn toggle_row_selected(&mut self, row_nr: u64, currently_selected: bool) {
        if currently_selected {
            self.shared.logs.selected_log = None;
        } else {
            // Scroll to log in search if it's active only.
            if self.shared.bottom_tab == BottomTabType::Search {
                let nearest_cmd = SessionCommand::GetNearestPosition(row_nr);
                self.actions
                    .try_send_command(&self.table.cmd_tx, nearest_cmd);
            }

            self.actions
                .try_send_command(&self.table.cmd_tx, SessionCommand::GetSelectedLog(row_nr));
        };
    }
}

impl TableDelegate for LogsDelegate<'_> {
    fn prepare(&mut self, info: &PrefetchInfo) {
        if self.shared.logs.logs_count == 0 {
            return;
        }

        let PrefetchInfo { visible_rows, .. } = info;

        let logs_rx = if self
            .table
            .last_visible_rows
            .as_ref()
            .is_some_and(|row| row == visible_rows)
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

            let range = LineRange::from(visible_rows.start..=visible_rows.end.saturating_sub(1));

            let (logs_tx, logs_rx) = std::sync::mpsc::channel();
            let cmd = SessionCommand::GrabLinesBlocking {
                range,
                sender: logs_tx,
            };

            if !self.actions.send_command_with_retry(
                &self.table.cmd_tx,
                cmd,
                SEND_INTERVAL,
                SEND_RETRY_MAX_COUNT,
            ) {
                return;
            }

            logs_rx
        };

        if let Ok(elements) = logs_rx.recv_timeout(TIMEOUT_DURATION) {
            match elements {
                Ok(elements) => self.table.logs.append(elements),
                Err(error) => {
                    let session_id = self.shared.get_id();
                    log::error!("Session Error: Session ID: {session_id}, error: {error}");

                    let notifi = AppNotification::SessionError { session_id, error };

                    self.actions.add_notification(notifi);
                }
            }
        } else {
            log::debug!("Grabber request timed out. Frame is passed without updating data.");
            self.table.pending_logs_rx = Some(logs_rx);
            self.request_repaint = true;
        }
=======
    session_data: &'a SessionState,
    min_line: u64,
    max_line: u64,
}

impl TableDelegate for LogsDelegate<'_> {
    fn prepare(&mut self, _info: &egui_table::PrefetchInfo) {
        //TODO: I need to check here if the data is already available
        //TODO AAZ: Deal with max and min here.
>>>>>>> e8b8dd3f7 (Integrating core session in native UI with text files (WIP))
    }

    fn header_cell_ui(&mut self, ui: &mut Ui, cell: &HeaderCellInfo) {
        Frame::NONE
            .inner_margin(Margin::symmetric(4, 0))
            .show(ui, |ui| {
<<<<<<< HEAD
                let (header, tooltip) = match cell.group_index {
                    0 => ("Nr.", "Log Position"),
                    idx => self
                        .table
                        .schema
                        .columns()
                        .get(idx.saturating_sub(1))
                        .map(|col| (col.header.as_str(), col.header_tooltip.as_str()))
                        .unwrap_or_default(),
                };

                ui.label(header).on_hover_text(tooltip);
=======
                let header = match cell.group_index {
                    0 => "Nr.",
                    1 => "Log",
                    invalid => panic!("Invalid header index {invalid}"),
                };
                ui.label(header);
>>>>>>> e8b8dd3f7 (Integrating core session in native UI with text files (WIP))
            });
    }

    fn row_ui(&mut self, ui: &mut Ui, row_nr: u64) {
        let is_selected = self.is_row_selected(row_nr);

        let mut invert_fg = is_selected;

        if is_selected {
            ui.painter()
                .rect_filled(ui.max_rect(), 0.0, Color32::DARK_GREEN);
        } else {
            let highlight_match = self
                .shared
                .search
                .current_matches_map()
                .is_some_and(|map| map.contains_key(&LogMainIndex(row_nr)));

            if highlight_match {
                invert_fg = true;
                ui.painter()
                    .rect_filled(ui.max_rect(), 0.0, Color32::DARK_GRAY);
            }
        }

        if invert_fg {
            ui.style_mut().visuals.override_text_color = Some(Color32::WHITE);
        }

        if ui.response().interact(Sense::click()).clicked() {
            self.toggle_row_selected(row_nr, is_selected);
        }
    }

    fn cell_ui(&mut self, ui: &mut egui::Ui, cell: &egui_table::CellInfo) {
        let &CellInfo { col_nr, row_nr, .. } = cell;
<<<<<<< HEAD

        Frame::NONE
            .inner_margin(Margin::symmetric(4, 0))
            .show(ui, |ui| match col_nr {
                0 => {
                    ui.label(row_nr.to_string());
                }
                _ => {
                    let content = match self
                        .table
                        .logs
                        .get_log_content(&row_nr, col_nr.saturating_sub(1))
                    {
                        Some(c) => c,
                        None => {
                            // Ensure data will be requested on next frame.
                            if self.table.pending_logs_rx.is_none() {
                                self.table.last_visible_rows = None;
                            }

                            "Loading..."
                        }
                    };

                    if Label::new(content).ui(ui).clicked() {
                        let is_selected = self.is_row_selected(row_nr);
                        self.toggle_row_selected(row_nr, is_selected);
                    }
=======
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
>>>>>>> e8b8dd3f7 (Integrating core session in native UI with text files (WIP))
                }
            });
    }
}
