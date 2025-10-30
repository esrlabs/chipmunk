use egui::{CentralPanel, TopBottomPanel, Ui};
use state::SessionUiState;

use crate::{
    host::ui::UiActions,
    session::{
        InitSessionParams, SessionInfo,
        command::SessionCommand,
        communication::{UiHandle, UiReceivers, UiSenders},
    },
};
use bottom_panel::BottomPanelUI;
use logs_table::LogsTable;

mod bottom_panel;
mod logs_table;
mod state;
mod status_bar;

#[derive(Debug)]
pub struct SessionUI {
    session_info: SessionInfo,
    senders: UiSenders,
    receivers: UiReceivers,
    state: SessionUiState,
    logs_table: LogsTable,
    bottom_panel: BottomPanelUI,
}

impl SessionUI {
    pub fn new(init: InitSessionParams) -> Self {
        let InitSessionParams {
            session_info,
            communication,
        } = init;

        let UiHandle { senders, receivers } = communication;

        Self {
            session_info,
            senders,
            receivers,
            state: SessionUiState::default(),
            logs_table: LogsTable::default(),
            bottom_panel: BottomPanelUI::default(),
        }
    }

    pub fn get_info(&self) -> &SessionInfo {
        &self.session_info
    }

    pub fn close_session(&self, actions: &mut UiActions) {
        actions.try_send_command(&self.senders.cmd_tx, SessionCommand::CloseSession);
    }

    pub fn render_content(&mut self, actions: &mut UiActions, ui: &mut Ui) {
        let Self {
            senders,
            receivers,
            logs_table,
            bottom_panel,
            ..
        } = self;
        let data = receivers.session_state_rx.borrow_and_update();

        TopBottomPanel::bottom("status_bar").show(ui.ctx(), |ui| {
            status_bar::render_content(&data, ui);
        });

        TopBottomPanel::bottom("bottom_panel")
            .height_range(100.0..=500.0)
            .default_height(200.)
            .resizable(true)
            .show(ui.ctx(), |ui| {
                bottom_panel.render_content(&data, senders, ui);
            });

        CentralPanel::default().show(ui.ctx(), |ui| {
            // We need to give a unique id for the direct parent of each table because
            // they will be used as identifiers for table state to avoid ID clashes between
            // tables from different tabs (different sessions).
            ui.push_id(self.session_info.id, |ui| {
                logs_table.render_content(&data, senders, ui);
            });
        });
    }

    /// Check incoming events and handle them.
    pub fn handle_events(&mut self) {
        while let Ok(event) = self.receivers.event_rx.try_recv() {
            match event {}
        }
    }
}
