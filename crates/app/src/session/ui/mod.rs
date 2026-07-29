use std::{
    ops::ControlFlow,
    rc::Rc,
    sync::{Arc, mpsc::Receiver as StdReceiver},
};

use egui::{CentralPanel, Context, Frame, Margin, Panel, Ui};
use log::warn;
use session_core::state::NestedMatch;
use tokio::sync::mpsc::{Sender, error::TrySendError};
use uuid::Uuid;

use crate::{
    common::ui::{
        RESIZABLE_PANEL_DEFAULT_SIZE, RESIZABLE_PANEL_MAX_SIZE, RESIZABLE_PANEL_MIN_SIZE,
        modal::show_busy_indicator,
    },
    host::{
        command::HostCommand,
        notification::AppNotification,
        ui::{
            HostAction, UiActions,
            registry::{HostRegistry, filters::FilterRegistry},
            shortcuts::state::LastShortcutKey,
            state::HostPreferences,
            storage::{
                HostStorage,
                recent::session::{RecentSessionSource, RecentSessionStateSnapshot},
            },
        },
    },
    session::{
        RecentSessionRuntimeInit, SessionUiInit,
        command::SessionCommand,
        communication::{UiHandle, UiReceivers},
        error::SessionError,
        message::{BookmarkUpdate, SessionMessage},
        types::{OperationPhase, attachment::PreviewTarget},
        ui::{
            sde_bar::SdeBarUi,
            shared::{SearchSyncOutcome, SearchTableSync, SessionSignal},
        },
    },
};
use bottom_panel::{BottomPanelUI, BottomTabType};
use common::log_table::{LogTableKind, table::TableScroll};
use logs_table::LogsTable;
use side_panel::{SidePanelUi, SideTabType};

mod attachment_modal;
mod bottom_panel;
mod common;
pub mod definitions;
mod export_modal;
mod logs_table;
mod recent;
mod sde_bar;
mod shared;
mod shortcuts;
mod side_panel;
mod status_bar;

pub use bottom_panel::chart;
pub use recent::RecentSessionRuntime;
pub use shared::{SessionInfo, SessionShared};
pub use shortcuts::shortcut_defs;

#[derive(Debug)]
pub struct Session {
    cmd_tx: Sender<SessionCommand>,
    receivers: UiReceivers,
    shared: SessionShared,
    pub recent_session: RecentSessionRuntime,
    logs_table: LogsTable,
    sde_bar: SdeBarUi,
    bottom_panel: BottomPanelUI,
    side_panel: SidePanelUi,
    attachment_modal: attachment_modal::AttachmentModalUi,
}

impl Session {
    pub fn new(init: SessionUiInit, host_cmd_tx: Sender<HostCommand>) -> Self {
        let SessionUiInit {
            session_info,
            schema_spec,
            recent_runtime,
            communication,
            observe_op,
        } = init;
        let RecentSessionRuntimeInit {
            tracking,
            additional_observe_ops,
        } = recent_runtime;

        let UiHandle { senders, receivers } = communication;

        let side_panel = SidePanelUi::new(&observe_op, host_cmd_tx.clone(), senders.cmd_tx.clone());
        let mut shared = SessionShared::new(session_info, observe_op, schema_spec);
        for observe_op in additional_observe_ops {
            shared.add_operation(observe_op);
        }

        let logs_table = LogsTable::new(senders.cmd_tx.clone(), Rc::clone(&shared.schema));
        let bottom_panel = BottomPanelUI::new(
            senders.cmd_tx.clone(),
            host_cmd_tx,
            Rc::clone(&shared.schema),
        );
        let sde_bar = SdeBarUi::new(senders.cmd_tx.clone(), &shared);

        let recent_session = match tracking {
            Some(init) => RecentSessionRuntime::new(init.source_key, init.supports_bookmarks),
            None => RecentSessionRuntime::untracked(),
        };

        Self {
            receivers,
            side_panel,
            shared,
            recent_session,
            logs_table,
            sde_bar,
            bottom_panel,
            attachment_modal: attachment_modal::AttachmentModalUi::new(),
            cmd_tx: senders.cmd_tx,
        }
    }

    pub fn get_info(&self) -> &SessionInfo {
        self.shared.get_info()
    }

    /// Returns whether this session currently has stream input controls available.
    pub fn sde_available(&self) -> bool {
        self.sde_bar.is_available()
    }

    pub fn render_content(
        &mut self,
        actions: &mut UiActions,
        registry: &mut HostRegistry,
        preferences: &mut HostPreferences,
        ui: &mut Ui,
    ) {
        let Self {
            cmd_tx,
            logs_table,
            sde_bar,
            bottom_panel,
            side_panel,
            shared,
            ..
        } = self;

        debug_assert!(
            shared.signals.is_empty(),
            "Signals leaked from previous frame."
        );

        shared.exports.handle_dialogs(actions, cmd_tx);

        Self::render_busy_indicator(shared, actions, ui);

        Panel::bottom("status_bar")
            .resizable(false)
            .exact_size(23.0)
            .show_inside(ui, |ui| {
                status_bar::render_content(shared, ui);
            });

        Panel::right("side_panel")
            .frame(Frame::side_top_panel(ui.style()).inner_margin(Margin::same(0)))
            .size_range(RESIZABLE_PANEL_MIN_SIZE..=RESIZABLE_PANEL_MAX_SIZE)
            .default_size(RESIZABLE_PANEL_DEFAULT_SIZE)
            .resizable(true)
            .show_animated_inside(ui, preferences.panels_visibility.right, |ui| {
                ui.take_available_width();
                side_panel.render_content(ui, shared, actions, registry);
            });

        Panel::bottom("bottom_panel")
            .frame(Frame::side_top_panel(ui.style()).inner_margin(Margin::ZERO))
            .size_range(RESIZABLE_PANEL_MIN_SIZE..=RESIZABLE_PANEL_MAX_SIZE)
            .default_size(RESIZABLE_PANEL_DEFAULT_SIZE)
            .resizable(true)
            .show_animated_inside(ui, preferences.panels_visibility.bottom, |ui| {
                ui.take_available_height();
                bottom_panel.render_content(shared, actions, registry, ui);
            });

        if preferences.sde_bar_visible && sde_bar.is_available() {
            Panel::bottom("sde_bar")
                .resizable(false)
                .show_separator_line(false)
                .exact_size(30.0)
                .frame(Frame::NONE.outer_margin(Margin::same(2)))
                .show_inside(ui, |ui| {
                    ui.push_id(shared.get_id(), |ui| {
                        sde_bar.render_content(actions, ui);
                    });
                });
        }

        CentralPanel::default()
            .frame(Frame::central_panel(ui.style()).inner_margin(Margin::ZERO))
            .show_inside(ui, |ui| {
                // We need to give a unique id for the direct parent of each table because
                // they will be used as identifiers for table state to avoid ID clashes between
                // tables from different tabs (different sessions).
                ui.push_id(shared.get_id(), |ui| {
                    logs_table.render_content(shared, actions, preferences, ui);
                });
            });

        export_modal::render_content(&mut shared.exports, actions, ui);

        self.attachment_modal
            .render_content(&mut shared.attachments, ui);

        self.handle_signals(registry, preferences);
    }

    fn render_busy_indicator(shared: &SessionShared, actions: &mut UiActions, ui: &Ui) {
        if shared
            .observe
            .show_startup_spinner(shared.logs.logs_count())
        {
            show_busy_indicator(
                ui,
                Some("Initializing Session"),
                Some(|| actions.add_host_action(HostAction::CloseSession(shared.get_id()))),
            );

            return;
        }

        if let Some(label) = shared.exports.busy_label() {
            show_busy_indicator(ui, Some(label), Option::<fn()>::None);
        }
    }

    /// Processes frame-local signals queued by child session components.
    fn handle_signals(&mut self, registry: &mut HostRegistry, preferences: &mut HostPreferences) {
        let signals = std::mem::take(&mut self.shared.signals);
        for event in signals {
            match event {
                SessionSignal::SearchDropped => self.handle_search_dropped(),
                SessionSignal::CapturePreset => self.capture_preset(registry, preferences),
            }
        }
    }

    fn handle_search_dropped(&mut self) {
        self.close_nested_search();
        self.bottom_panel.search.table.clear();
        self.bottom_panel.chart.reset();
    }

    /// Opens the presets panel and captures the current session filters and charts.
    fn capture_preset(&mut self, registry: &mut HostRegistry, preferences: &mut HostPreferences) {
        preferences.panels_visibility.bottom = true;
        self.shared.bottom_tab = BottomTabType::Presets;
        self.bottom_panel
            .presets
            .capture_preset(&self.shared, registry);
    }

    /// Check incoming messages and handle them.
    pub fn handle_messages(
        &mut self,
        actions: &mut UiActions,
        storage: &mut HostStorage,
        registry: &HostRegistry,
    ) {
        while let Ok(msg) = self.receivers.message_rx.try_recv() {
            match msg {
                SessionMessage::LogsCount(count) => {
                    self.shared.logs.set_logs_count(count);
                    // Keep live-follow charts attached to the growing session span.
                    self.bottom_panel.chart.on_chart_data_changes(&self.shared);
                }
                SessionMessage::IndexedCountUpdated { count } => {
                    self.shared.search.set_indexed_result_count(count);
                }
                SessionMessage::SelectedLog(log_element) => {
                    if let Some(mut selected) = self.ok_or_notify(log_element, actions) {
                        self.shared.schema.prepare_log(&mut selected);

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
                SessionMessage::NearestIndexedRow { result } => {
                    if let Some(Some(indexed_row_index)) = self.ok_or_notify(result, actions) {
                        self.bottom_panel
                            .search
                            .table
                            .scroll_to_indexed_row(indexed_row_index);
                    }
                }
                SessionMessage::NestedMatchResult { request_id, result } => {
                    self.handle_nested_result(request_id, result, actions);
                }
                SessionMessage::IndexedNeighbor(row) => {
                    self.shared.logs.focus_main_row(row, SearchTableSync::Sync);
                }
                SessionMessage::BookmarkUpdated(updates) => {
                    for BookmarkUpdate { row, is_bookmarked } in updates {
                        if is_bookmarked {
                            self.shared.insert_bookmark(row);
                        } else {
                            self.shared.remove_bookmark(row);
                        }
                    }

                    if !self.nested_search_available() {
                        self.close_nested_search();
                    }
                }
                SessionMessage::ChartHistogram(map) => {
                    let Some(map) = self.ok_or_notify(map, actions) else {
                        continue;
                    };

                    self.bottom_panel.chart.update_histogram(map);
                }
                SessionMessage::ChartLinePlots(values) => {
                    let Some(values) = self.ok_or_notify(values, actions) else {
                        continue;
                    };

                    self.bottom_panel.chart.update_line_plots(values);
                }
                SessionMessage::ChartSearchValues(values) => {
                    self.shared.search_values.set_values_map(values);
                    self.bottom_panel.chart.on_chart_data_changes(&self.shared);
                }
                SessionMessage::SourceAdded { observe_op } => {
                    let appended_sources =
                        RecentSessionSource::from_observe_origin(observe_op.origin.clone());
                    self.shared.add_operation(*observe_op);
                    self.sde_bar.refresh_targets(&self.shared);

                    let current_source_key = match self.recent_session.source_key() {
                        Some(key) => Arc::clone(key),
                        _ => continue,
                    };

                    // Rebind this live session to the appended source-set snapshot.
                    let recent_state = self
                        .recent_session
                        .capture_opened_state(&self.shared, &registry.filters);

                    let rebind_res = storage.recent_sessions.rebind_after_append(
                        current_source_key,
                        appended_sources,
                        recent_state,
                    );

                    match rebind_res {
                        Some(new_source_key) => self.recent_session.set_source_key(new_source_key),
                        None => self.recent_session.clear_source_key(),
                    }
                }
                SessionMessage::OperationUpdated {
                    operation_id,
                    phase,
                } => {
                    if self
                        .on_operation_updated(operation_id, phase, actions, &registry.filters)
                        .is_break()
                    {
                        continue;
                    }
                    // Potential components which keep track for operations can go here.
                }
                SessionMessage::FileReadCompleted => {
                    self.shared.observe.set_file_read_completed();
                    self.recent_session
                        .on_file_read_completed(&self.shared, actions, &self.cmd_tx);
                }
                SessionMessage::AttachmentsUpdated { attachment, len } => {
                    self.shared.attachments.add(*attachment);
                    if self.shared.attachments.attachments().len() as u64 != len {
                        warn!(
                            "Unexpected internal error: Attachment count mismatch: expected {} from backend, got {}.",
                            len,
                            self.shared.attachments.attachments().len()
                        );
                    }
                }
                SessionMessage::SdeSendFinished(result) => {
                    self.sde_bar.handle_result(result, actions);
                }
                SessionMessage::AttachmentPreview {
                    attachment_id,
                    target,
                    preview,
                } => match self.ok_or_notify(preview, actions) {
                    Some(content) => match target {
                        PreviewTarget::SidePanel => {
                            self.side_panel
                                .attachments
                                .handle_preview_response(attachment_id, content);
                        }
                        PreviewTarget::Modal => {
                            self.shared
                                .attachments
                                .handle_modal_preview(attachment_id, content);
                        }
                    },
                    None => match target {
                        PreviewTarget::SidePanel => {
                            self.side_panel
                                .attachments
                                .clear_pending_preview(attachment_id);
                        }
                        PreviewTarget::Modal => {
                            self.shared.attachments.close_pending_modal(attachment_id);
                        }
                    },
                },
            }
        }

        debug_assert!(
            self.shared.signals.is_empty(),
            "Session messages must not emit render-frame signals."
        );
    }

    fn handle_nested_result(
        &mut self,
        request_id: Uuid,
        result: Result<Option<NestedMatch>, SessionError>,
        actions: &mut UiActions,
    ) {
        if !self.shared.search.nested_mut().accept_response(request_id) {
            return;
        }

        let Some(nested_match) = self.ok_or_notify(result, actions) else {
            return;
        };
        let Some(nested_match) = nested_match else {
            self.shared.search.nested_mut().set_no_match();

            return;
        };

        self.shared
            .search
            .nested_mut()
            .set_match(nested_match.search_result_index);
        self.shared
            .logs
            .focus_main_row(nested_match.session_position, SearchTableSync::Skip);
        self.bottom_panel
            .search
            .table
            .scroll_to_indexed_row(nested_match.indexed_row_index);
    }

    fn on_operation_updated(
        &mut self,
        operation_id: Uuid,
        phase: OperationPhase,
        actions: &mut UiActions,
        registry: &FilterRegistry,
    ) -> ControlFlow<()> {
        let is_observe_operation = self
            .shared
            .observe
            .operations()
            .iter()
            .any(|operation| operation.id == operation_id);

        // Observe processing starts after the backend creates or links the session file.
        let observe_started_processing =
            phase == OperationPhase::Processing && is_observe_operation;

        if !self
            .shared
            .update_operation(operation_id, phase, actions)
            .consumed()
        {
            return ControlFlow::Continue(());
        }

        if is_observe_operation {
            self.sde_bar.refresh_targets(&self.shared);
        }

        if observe_started_processing {
            let outcome = self
                .recent_session
                .on_session_file_ready(&mut self.shared, registry);
            if let Some(outcome) = outcome {
                let SearchSyncOutcome {
                    commands,
                    log_search_dropped,
                } = outcome;

                if log_search_dropped {
                    self.handle_search_dropped();
                }

                for cmd in commands {
                    actions.try_send_command(&self.cmd_tx, cmd);
                }
            }
        }

        ControlFlow::Break(())
    }

    /// Applies the restored recent-session state through the normal session and registry path.
    pub fn apply_recent_restore(
        &mut self,
        restore_state: RecentSessionStateSnapshot,
        registry: &mut HostRegistry,
    ) {
        self.recent_session
            .apply_restore(restore_state, &mut self.shared, &mut registry.filters);
        debug_assert!(
            self.shared.signals.is_empty(),
            "Recent-session restore must not emit render-frame signals."
        );
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

    /// Requests normal tab close without waiting for cleanup confirmation.
    pub fn request_tab_close(&self, actions: &mut UiActions) {
        actions.try_send_command(
            &self.cmd_tx,
            SessionCommand::CloseSession { confirm_tx: None },
        );
    }

    /// Requests service shutdown from the synchronous eframe shutdown path.
    pub fn request_shutdown_with_ack(&mut self) -> Option<StdReceiver<()>> {
        self.receivers.message_rx.close();
        while self.receivers.message_rx.try_recv().is_ok() {}

        let (confirm_tx, confirm_rx) = std::sync::mpsc::channel();
        let command = SessionCommand::CloseSession {
            confirm_tx: Some(confirm_tx),
        };

        match self.cmd_tx.try_send(command) {
            Ok(()) => Some(confirm_rx),
            Err(TrySendError::Closed(_)) => {
                warn!(
                    "Session shutdown command channel is closed for {}",
                    self.shared.get_id()
                );
                None
            }
            Err(TrySendError::Full(_)) => {
                warn!(
                    "Session shutdown command channel is full for {}",
                    self.shared.get_id()
                );
                None
            }
        }
    }

    /// Returns whether Find in Search Results can be shown for the active indexed table.
    pub fn nested_search_available(&self) -> bool {
        self.bottom_panel.search.table_available(&self.shared)
    }

    /// Toggles Find in Search Results and reveals its bottom-panel table when available.
    pub fn toggle_nested_search(&mut self, preferences: &mut HostPreferences) {
        if !self.nested_search_available() {
            self.close_nested_search();
            return;
        }

        if self.shared.search.nested().is_visible() {
            self.close_nested_search();
        } else {
            self.bottom_panel.search.open_nested(&mut self.shared);
            self.activate_bottom_tab(BottomTabType::Search, preferences);
        }
    }

    fn close_nested_search(&mut self) {
        self.bottom_panel.search.close_nested(&mut self.shared);
    }

    pub fn handle_shortcuts(
        &mut self,
        actions: &mut UiActions,
        preferences: &mut HostPreferences,
        ctx: &Context,
        last_key: Option<&LastShortcutKey>,
    ) -> bool {
        shortcuts::handle(self, actions, preferences, ctx, last_key)
    }

    fn activate_search_tab(&mut self, preferences: &mut HostPreferences) {
        self.bottom_panel.search.bar.request_focus();
        self.activate_bottom_tab(BottomTabType::Search, preferences);
    }

    fn activate_main_logs_table(&mut self, ctx: &Context) {
        self.shared.view.active_log_table = LogTableKind::Main;
        clear_text_edit_focus(ctx);
    }

    fn activate_search_results_table(&mut self, preferences: &mut HostPreferences, ctx: &Context) {
        self.activate_bottom_tab(BottomTabType::Search, preferences);
        self.shared.view.active_log_table = LogTableKind::Search;
        clear_text_edit_focus(ctx);
    }

    fn activate_bottom_tab(&mut self, tab: BottomTabType, preferences: &mut HostPreferences) {
        preferences.panels_visibility.bottom = true;
        self.shared.bottom_tab = tab;
    }

    fn activate_side_tab(&mut self, tab: SideTabType, preferences: &mut HostPreferences) {
        preferences.panels_visibility.right = true;
        self.shared.side_tab = tab;
    }

    fn scroll_main_table(&mut self, action: TableScroll) {
        self.logs_table
            .scroll(action, self.shared.logs.logs_count());
    }

    fn scroll_active_table(
        &mut self,
        action: TableScroll,
        preferences: &mut HostPreferences,
        ctx: &Context,
    ) {
        let active_target = match self.shared.view.log_table_target(ctx) {
            Some(LogTableKind::Search) => {
                let search_table_visible = preferences.panels_visibility.bottom
                    && self.shared.bottom_tab == BottomTabType::Search;
                if search_table_visible {
                    LogTableKind::Search
                } else {
                    self.shared.view.active_log_table = LogTableKind::Main;
                    LogTableKind::Main
                }
            }
            Some(LogTableKind::Main) | None => LogTableKind::Main,
        };

        match active_target {
            LogTableKind::Main => self.scroll_main_table(action),
            LogTableKind::Search => self.scroll_search_table(action, preferences),
        }
    }

    fn scroll_search_table(&mut self, action: TableScroll, preferences: &mut HostPreferences) {
        // Don't scroll if search table isn't visible.
        if !preferences.panels_visibility.bottom || self.shared.bottom_tab != BottomTabType::Search
        {
            return;
        }

        self.bottom_panel
            .search
            .table
            .scroll(action, self.shared.search.indexed_result_count());
    }

    /// Converts the Result to Option and handle errors by adding them as a notification
    /// to the provided `actions`
    fn ok_or_notify<T>(&self, res: Result<T, SessionError>, actions: &mut UiActions) -> Option<T> {
        match res {
            Ok(val) => Some(val),
            Err(error) => {
                let session_id = self.shared.get_id();
                log::error!("Session Error: Session ID: {session_id}, error: {error}");

                let notifi = AppNotification::SessionError(error);

                actions.add_notification(notifi);

                None
            }
        }
    }
}

fn clear_text_edit_focus(ctx: &Context) {
    if ctx.text_edit_focused() {
        ctx.memory_mut(|memory| memory.stop_text_input());
    }
}

#[cfg(test)]
mod tests {
    use std::path::PathBuf;

    use processor::search::filter::SearchFilter;
    use session_core::state::{IndexedNavigation, NestedMatch};
    use stypes::{FileFormat, ObserveOrigin};
    use tokio::{runtime::Runtime, sync::mpsc};
    use uuid::Uuid;

    use super::{SearchTableSync, Session};
    use crate::{
        host::{common::parsers::ParserNames, ui::UiActions},
        session::{
            RecentSessionRuntimeInit, SessionUiInit,
            command::SessionCommand,
            communication::{self, ServiceHandle, SharedSenders},
            types::ObserveOperation,
            ui::{SessionInfo, definitions::schema::LogSchemaSpec},
        },
    };

    fn new_session() -> (Session, ServiceHandle, Runtime, UiActions) {
        let runtime = Runtime::new().expect("runtime should initialize");
        let (host_message_tx, _host_message_rx) = mpsc::channel(4);
        let (notification_tx, _notification_rx) = mpsc::channel(4);
        let shared_senders =
            SharedSenders::new(host_message_tx, notification_tx, egui::Context::default());
        let (communication, service) = communication::init(shared_senders);
        let (host_cmd_tx, _host_cmd_rx) = mpsc::channel(4);

        let session_id = Uuid::new_v4();
        let origin = ObserveOrigin::File(
            "source".to_owned(),
            FileFormat::Text,
            PathBuf::from("source.log"),
        );
        let observe_op = ObserveOperation::new(Uuid::new_v4(), origin);
        let session_info = SessionInfo {
            id: session_id,
            title: "test".to_owned(),
            parser: ParserNames::Text,
            raw_export_supported: false,
        };
        let recent_runtime = RecentSessionRuntimeInit {
            tracking: None,
            additional_observe_ops: Vec::new(),
        };
        let init = SessionUiInit {
            session_info,
            schema_spec: LogSchemaSpec::Text,
            recent_runtime,
            communication,
            observe_op,
        };
        let actions = UiActions::new(runtime.handle().clone());

        (Session::new(init, host_cmd_tx), service, runtime, actions)
    }

    fn start_request(
        session: &mut Session,
        service: &mut ServiceHandle,
        actions: &mut UiActions,
    ) -> Uuid {
        assert!(
            session
                .shared
                .search
                .nested_mut()
                .apply_filter(SearchFilter::plain("warn"))
                .is_eligible()
        );
        assert!(session.shared.search.nested_mut().request_match(
            IndexedNavigation::Next,
            &session.cmd_tx,
            actions,
        ));

        match service
            .cmd_rx
            .try_recv()
            .expect("nested command should be sent")
        {
            SessionCommand::FindNestedMatch { request_id, .. } => request_id,
            other => panic!("expected nested command, got {other:?}"),
        }
    }

    #[test]
    fn nested_success_routes_selection_and_anchor_coordinates() {
        let (mut session, mut service, _runtime, mut actions) = new_session();
        let request_id = start_request(&mut session, &mut service, &mut actions);

        // Primary results [10, 30, 70] with bookmarks [20, 40] put session row 70 at
        // search-result index 2 and indexed-row index 4.
        let found = NestedMatch {
            session_position: 70,
            search_result_index: 2,
            indexed_row_index: 4,
        };
        session.handle_nested_result(request_id, Ok(Some(found)), &mut actions);

        assert_eq!(session.shared.logs.single_selected_row(), Some(70));
        let focus = session
            .shared
            .logs
            .take_main_row_focus()
            .expect("success should focus the main row");
        assert_eq!(focus.row, 70);
        assert_eq!(focus.search_table_sync, SearchTableSync::Skip);

        assert!(session.shared.search.nested_mut().request_match(
            IndexedNavigation::Next,
            &session.cmd_tx,
            &mut actions,
        ));
        match service
            .cmd_rx
            .try_recv()
            .expect("follow-up nested command should be sent")
        {
            SessionCommand::FindNestedMatch {
                search_result_anchor,
                ..
            } => assert_eq!(search_result_anchor, Some(2)),
            other => panic!("expected nested command, got {other:?}"),
        }
    }

    #[test]
    fn stale_and_closed_responses_do_not_select_or_focus() {
        let (mut session, mut service, _runtime, mut actions) = new_session();
        let request_id = start_request(&mut session, &mut service, &mut actions);
        let found = NestedMatch {
            session_position: 70,
            search_result_index: 2,
            indexed_row_index: 4,
        };

        let stale_request_id = Uuid::new_v4();
        let stale_found = found.clone();
        session.handle_nested_result(stale_request_id, Ok(Some(stale_found)), &mut actions);
        assert!(session.shared.search.nested().is_pending());
        assert_eq!(session.shared.logs.single_selected_row(), None);
        assert!(session.shared.logs.take_main_row_focus().is_none());

        session.close_nested_search();
        session.handle_nested_result(request_id, Ok(Some(found)), &mut actions);
        assert_eq!(session.shared.logs.single_selected_row(), None);
        assert!(session.shared.logs.take_main_row_focus().is_none());
    }

    #[test]
    fn no_match_preserves_selection_without_focus() {
        let (mut session, mut service, _runtime, mut actions) = new_session();
        session.shared.logs.replace_selection_with(9);
        let request_id = start_request(&mut session, &mut service, &mut actions);

        session.handle_nested_result(request_id, Ok(None), &mut actions);

        assert_eq!(session.shared.logs.single_selected_row(), Some(9));
        assert!(session.shared.logs.take_main_row_focus().is_none());
    }
}
