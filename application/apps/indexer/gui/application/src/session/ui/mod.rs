use egui::{CentralPanel, TopBottomPanel, Ui};
use state::SessionUiState;

use crate::{
    host::ui::UiActions,
    session::{
        InitSessionParams, SessionInfo,
        command::SessionCommand,
        communication::{UiHandle, UiReceivers, UiSenders},
        ui::logs_table::LogsTable,
    },
};

mod logs_table;
mod state;
mod status_bar;

#[derive(Debug)]
pub struct SessionUI {
    session_info: SessionInfo,
    senders: UiSenders,
    receivers: UiReceivers,
    state: SessionUiState,
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
        }
    }

    pub fn get_info(&self) -> &SessionInfo {
        &self.session_info
    }

    pub fn close_session(&self, actions: &mut UiActions) {
        actions.try_send_command(&self.senders.cmd_tx, SessionCommand::CloseSession);
    }

    pub fn render_content(&mut self, actions: &mut UiActions, ui: &mut Ui) {
        let data = self.receivers.session_state_rx.borrow_and_update();

        TopBottomPanel::bottom("status_bar").show(ui.ctx(), |ui| {
            status_bar::render_content(&data, ui);
        });

        CentralPanel::default().show(ui.ctx(), |ui| {
            LogsTable::render_content(&data, ui, actions);
        });
    }

    /// Check incoming events and handle them.
    pub fn handle_events(&mut self) {
        while let Ok(event) = self.receivers.event_rx.try_recv() {
            match event {}
        }
    }
}
