use std::rc::Rc;

use egui::{CentralPanel, Frame, Margin, Panel, Ui};
use log::warn;
use tokio::sync::mpsc::Sender;

use crate::{
    common::modal::show_busy_indicator,
    host::{
        command::HostCommand,
        common::parsers::ParserNames,
        notification::AppNotification,
        ui::{
            HostAction, UiActions,
            registry::{HostRegistry, filters::FilterRegistry},
            state::PanelsVisibility,
            storage::RecentSessionStateSnapshot,
        },
    },
    session::{
        InitSessionParams,
        command::SessionCommand,
        communication::{UiHandle, UiReceivers},
        error::SessionError,
        message::{BookmarkUpdate, SessionMessage},
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
use side_panel::SidePanelUi;

mod bottom_panel;
mod common;
mod definitions;
mod logs_table;
mod recent;
mod shared;
mod side_panel;
mod status_bar;

pub use bottom_panel::chart;
pub use recent::RecentSessionRuntime;
pub use shared::{SessionInfo, SessionShared};

#[derive(Debug)]
pub struct Session {
    cmd_tx: Sender<SessionCommand>,
    receivers: UiReceivers,
    shared: SessionShared,
    recent_session: RecentSessionRuntime,
    logs_table: LogsTable,
    bottom_panel: BottomPanelUI,
    side_panel: SidePanelUi,
}

impl Session {
    pub fn new(init: InitSessionParams, host_cmd_tx: Sender<HostCommand>) -> Self {
        let InitSessionParams {
            session_info,
            recent_source_key,
            supports_bookmarks,
            communication,
            observe_op,
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
            side_panel: SidePanelUi::new(&observe_op, host_cmd_tx.clone(), senders.cmd_tx.clone()),
            shared: SessionShared::new(session_info, observe_op),
            recent_session: RecentSessionRuntime::new(recent_source_key, supports_bookmarks),
            logs_table: LogsTable::new(senders.cmd_tx.clone(), Rc::clone(&schema)),
            bottom_panel: BottomPanelUI::new(senders.cmd_tx.clone(), host_cmd_tx, schema),
            cmd_tx: senders.cmd_tx,
        }
    }

    pub fn get_info(&self) -> &SessionInfo {
        self.shared.get_info()
    }

    /// Applies the restored recent-session state through the normal session and registry path.
    ///
    /// Any UI signals emitted while rebuilding that state are handled immediately so the first
    /// render starts from a clean signal queue.
    pub fn apply_recent_restore(
        &mut self,
        restore_state: RecentSessionStateSnapshot,
        registry: &mut HostRegistry,
        actions: &mut UiActions,
    ) {
        self.recent_session.apply_restore(
            restore_state,
            &mut self.shared,
            actions,
            &self.cmd_tx,
            &mut registry.filters,
        );
        self.handle_signals();
    }

    /// Captures the canonical recent-session state after restore and establishes the update baseline.
    pub fn capture_opened_recent_state(
        &mut self,
        registry: &FilterRegistry,
    ) -> RecentSessionStateSnapshot {
        self.recent_session
            .capture_opened_state(&self.shared, registry)
    }

    /// Returns the next recent-session state update when tracked semantic state changed.
    pub fn take_recent_state_update(
        &mut self,
        registry: &FilterRegistry,
    ) -> Option<RecentSessionStateSnapshot> {
        self.recent_session
            .take_state_update(&self.shared, registry)
    }

    pub fn recent_source_key(&self) -> &str {
        self.recent_session.source_key()
    }

    pub fn on_close_session(&self, actions: &mut UiActions) {
        actions.try_send_command(&self.cmd_tx, SessionCommand::CloseSession);
    }

    pub fn render_content(
        &mut self,
        actions: &mut UiActions,
        registry: &mut HostRegistry,
        panels_visibility: &PanelsVisibility,
        ui: &mut Ui,
    ) {
        let Self {
            logs_table,
            bottom_panel,
            side_panel,
            shared,
            ..
        } = self;

        debug_assert!(
            shared.signals.is_empty(),
            "Signals leaked from previous frame."
        );

        if shared.observe.is_initial_loading() {
            show_busy_indicator(
                ui.ctx(),
                Some("Initializing Session"),
                Some(|| actions.add_host_action(HostAction::CloseSession(shared.get_id()))),
            );
        }

        Panel::bottom("status_bar")
            .resizable(false)
            .exact_size(23.0)
            .show_inside(ui, |ui| {
                status_bar::render_content(shared, ui);
            });

        Panel::right("side_panel")
            .frame(Frame::side_top_panel(ui.style()).inner_margin(Margin::same(0)))
            .size_range(200.0..=500.0)
            .default_size(250.0)
            .resizable(true)
            .show_animated_inside(ui, panels_visibility.right, |ui| {
                ui.take_available_width();
                side_panel.render_content(ui, shared, actions, registry);
            });

        let panels_margin = Margin {
            left: 2,
            right: 0,
            top: 0,
            bottom: 0,
        };

        Panel::bottom("bottom_panel")
            .frame(Frame::side_top_panel(ui.style()).inner_margin(panels_margin))
            .size_range(100.0..=700.0)
            .default_size(200.)
            .resizable(true)
            .show_animated_inside(ui, panels_visibility.bottom, |ui| {
                ui.take_available_height();
                bottom_panel.render_content(shared, actions, registry, ui);
            });

        CentralPanel::default()
            .frame(Frame::central_panel(ui.style()).inner_margin(panels_margin))
            .show_inside(ui, |ui| {
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
                    // Keep live-follow charts attached to the growing session span.
                    self.bottom_panel.chart.on_chart_data_changes(&self.shared);
                }
                SessionMessage::IndexedCountUpdated { count } => {
                    self.shared.search.set_indexed_result_count(count);
                }
                SessionMessage::SelectedLog(log_element) => {
                    if let Some(selected) = self.ok_or_notify(log_element, actions) {
                        let selected_row = self.shared.logs.single_selected_row();
                        self.bottom_panel
                            .details
                            .handle_selected_log(selected_row, selected);
                    }
                }
                SessionMessage::SearchResultCountUpdated { count } => {
                    self.shared.search.set_search_result_count(count);
                    self.bottom_panel.chart.on_chart_data_changes(&self.shared);
                }
                SessionMessage::SearchResults(filter_matches) => {
                    self.shared.search.append_matches(filter_matches);
                }
                SessionMessage::SearchResultsCleared => {
                    self.shared.search.clear_matches();
                }
                SessionMessage::NearestPosition(nearest_position) => {
                    if let Some(pos) = self.ok_or_notify(nearest_position, actions) {
                        self.bottom_panel.search.table.set_nearest_pos(pos);
                    }
                }
                SessionMessage::BookmarkUpdated(updates) => {
                    for BookmarkUpdate { row, is_bookmarked } in updates {
                        if is_bookmarked {
                            self.shared.insert_bookmark(row);
                        } else {
                            self.shared.remove_bookmark(row);
                        }
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
                SessionMessage::ChartSearchValues(values) => {
                    self.shared.search_values.set_values_map(values);
                    self.bottom_panel.chart.on_chart_data_changes(&self.shared);
                }
                SessionMessage::SourceAdded { observe_op } => {
                    self.recent_session.disable_updates();
                    self.shared.add_operation(*observe_op);
                }
                SessionMessage::OperationUpdated {
                    operation_id,
                    phase,
                } => {
                    if self.shared.update_operation(operation_id, phase).consumed() {
                        return;
                    }
                    // Potential components which keep track for operations can go here.
                }
                SessionMessage::FileReadCompleted => {
                    self.shared.observe.set_file_read_completed();
                    self.recent_session
                        .on_file_read_completed(&self.shared, actions, &self.cmd_tx);
                }
                SessionMessage::AttachmentsUpdated { attachment, len } => {
                    self.shared.attachments.add(attachment);
                    if self.shared.attachments.attachments().len() as u64 != len {
                        warn!(
                            "Unexpected internal error: Attachment count mismatch: expected {} from backend, got {}.",
                            len,
                            self.shared.attachments.attachments().len()
                        );
                    }
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
