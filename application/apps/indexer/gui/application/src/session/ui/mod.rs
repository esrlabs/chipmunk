use std::rc::Rc;

use egui::{CentralPanel, TopBottomPanel, Ui};
use shared::SessionShared;
use tokio::sync::mpsc::Sender;

use crate::{
    host::{common::parsers::ParserNames, notification::AppNotification, ui::UiActions},
    session::{
        InitSessionParams,
        command::SessionCommand,
        communication::{UiHandle, UiReceivers},
        error::SessionError,
        message::SessionMessage,
        ui::{
            definitions::schema::{
                LogSchema, dlt::DltLogSchema, plugins::PluginsLogSchema, someip::SomeIpLogSchema,
                text::TextLogSchema,
            },
            shared::SessionSignal,
        },
    },
};
use bottom_panel::BottomPanelUI;
use logs_table::LogsTable;

mod bottom_panel;
mod definitions;
mod logs_table;
mod shared;
mod status_bar;

pub use bottom_panel::chart;
pub use shared::SessionInfo;

#[derive(Debug)]
pub struct Session {
    cmd_tx: Sender<SessionCommand>,
    receivers: UiReceivers,
    shared: SessionShared,
    logs_table: LogsTable,
    bottom_panel: BottomPanelUI,
}

impl Session {
    pub fn new(init: InitSessionParams) -> Self {
        let InitSessionParams {
            session_info,
            communication,
        } = init;

        let UiHandle { senders, receivers } = communication;

        let schema: Rc<dyn LogSchema> = match &session_info.parser {
            ParserNames::Dlt => Rc::new(DltLogSchema::default()),
            ParserNames::SomeIP => Rc::new(SomeIpLogSchema::default()),
            ParserNames::Text => Rc::new(TextLogSchema::default()),
            ParserNames::Plugins => Rc::new(PluginsLogSchema),
        };

        Self {
            receivers,
            shared: SessionShared::new(session_info),
            logs_table: LogsTable::new(senders.cmd_tx.clone(), Rc::clone(&schema)),
            bottom_panel: BottomPanelUI::new(senders.cmd_tx.clone(), schema),
            cmd_tx: senders.cmd_tx,
        }
    }

    pub fn get_info(&self) -> &SessionInfo {
        self.shared.get_info()
    }

    pub fn close_session(&self, actions: &mut UiActions) {
        actions.try_send_command(&self.cmd_tx, SessionCommand::CloseSession);
    }

    pub fn render_content(&mut self, actions: &mut UiActions, ui: &mut Ui) {
        let Self {
            logs_table,
            bottom_panel,
            shared,
            ..
        } = self;

        debug_assert!(
            shared.signals.is_empty(),
            "Signals leaked from previous frame."
        );

        TopBottomPanel::bottom("status_bar").show_inside(ui, |ui| {
            status_bar::render_content(shared, ui);
        });

        TopBottomPanel::bottom("bottom_panel")
            .height_range(100.0..=700.0)
            .default_height(200.)
            .resizable(true)
            .show_inside(ui, |ui| {
                ui.take_available_height();
                bottom_panel.render_content(shared, actions, ui);
            });

        CentralPanel::default().show_inside(ui, |ui| {
            // We need to give a unique id for the direct parent of each table because
            // they will be used as identifiers for table state to avoid ID clashes between
            // tables from different tabs (different sessions).
            ui.push_id(shared.get_id(), |ui| {
                logs_table.render_content(shared, actions, ui);
            });
        });

        self.handle_signals();
    }

    fn handle_signals(&mut self) {
        for event in self.shared.signals.drain(..) {
            match event {
                SessionSignal::SearchDropped => {
                    self.bottom_panel.search.table.clear();
                    self.bottom_panel.chart.reset();
                }
            }
        }
    }

    /// Check incoming messages and handle them.
    pub fn handle_messages(&mut self, actions: &mut UiActions) {
        while let Ok(msg) = self.receivers.message_rx.try_recv() {
            match msg {
                SessionMessage::LogsCount(count) => {
                    self.shared.logs.logs_count = count;
                }
                SessionMessage::SelectedLog(log_element) => {
                    let selected = self.ok_or_notify(log_element, actions);
                    self.shared.logs.selected_log = selected;
                }
                SessionMessage::SearchState { found_count } => {
                    self.shared.search.total_count = found_count;
                    self.bottom_panel
                        .chart
                        .on_search_count_changes(&self.shared);
                }
                SessionMessage::SearchResults(filter_matches) => {
                    self.shared.search.append_matches(filter_matches);
                }
                SessionMessage::NearestPosition(nearest_position) => {
                    if let Some(pos) = self.ok_or_notify(nearest_position, actions) {
                        self.bottom_panel.search.table.set_nearest_pos(pos);
                    }
                }
                SessionMessage::ChartHistogram(map) => {
                    let Some(map) = self.ok_or_notify(map, actions) else {
                        return;
                    };

                    self.bottom_panel.chart.update_histogram(map);
                }
                SessionMessage::ChartLinePlots(values) => {
                    let Some(values) = self.ok_or_notify(values, actions) else {
                        return;
                    };

                    self.bottom_panel.chart.update_line_plots(values);
                }
            }
        }
    }

    /// Converts the Result to Option and handle errors by adding them as a notification
    /// to the provided `actions`
    fn ok_or_notify<T>(&self, res: Result<T, SessionError>, actions: &mut UiActions) -> Option<T> {
        match res {
            Ok(val) => Some(val),
            Err(error) => {
                let session_id = self.shared.get_id();
                log::error!("Session Error: Session ID: {session_id}, error: {error}");

                let notifi = AppNotification::SessionError { session_id, error };

                actions.add_notification(notifi);

                None
            }
        }
    }
}
