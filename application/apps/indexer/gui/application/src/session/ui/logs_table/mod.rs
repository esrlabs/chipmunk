use std::{ops::Range, time::Duration};

use egui::{Color32, Frame, Id, Label, Margin, RichText, Ui, Widget};
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
}

impl LogsTable {
    pub fn new(cmd_tx: Sender<SessionCommand>) -> Self {
        Self {
            cmd_tx,
            last_visible_rows: Default::default(),
            logs: LogsMapped::default(),
            pending_logs_rx: None,
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
            .columns(Self::text_columns())
            .auto_size_mode(AutoSizeMode::Never)
            .num_sticky_cols(1);

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
    }

    fn text_columns() -> Vec<Column> {
        vec![
            Column::new(100.0).range(50.0..=500.0).resizable(true),
            Column::default(),
        ]
    }
}

struct LogsDelegate<'a> {
    table: &'a mut LogsTable,
    shared: &'a mut SessionShared,
    actions: &'a mut UiActions,
    request_repaint: bool,
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
            .shared
            .logs
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
                    .shared
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
                    let content = match self.table.logs.get_log(&row_nr) {
                        Some(c) => c,
                        None => {
                            // Ensure data will be requested on next frame.
                            if self.table.pending_logs_rx.is_none() {
                                self.table.last_visible_rows = None;
                            }

                            "Loading..."
                        }
                    };

                    let label = if invert_fg {
                        let content = RichText::new(content).color(Color32::WHITE).strong();
                        Label::new(content)
                    } else {
                        Label::new(content)
                    };

                    if label.ui(ui).clicked() {
                        if is_selected {
                            self.shared.logs.selected_log = None;
                        } else {
                            // Scroll to log in search if it's active only.
                            if self.shared.active_bottom_tab == BottomTabType::Search {
                                let nearest_cmd = SessionCommand::GetNearestPosition(row_nr);
                                self.actions
                                    .try_send_command(&self.table.cmd_tx, nearest_cmd);
                            }

                            self.actions.try_send_command(
                                &self.table.cmd_tx,
                                SessionCommand::GetSelectedLog(row_nr),
                            );
                        };
                    }
                }
                invalid => panic!("Invalid column number. {invalid}"),
            });
    }
}
