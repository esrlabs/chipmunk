use egui::{CentralPanel, TopBottomPanel, Ui};
use state::SessionUiState;
use tokio::sync::mpsc::Sender;

use crate::{
    host::ui::UiActions,
    session::{
        InitSessionParams, SessionInfo,
        command::SessionCommand,
        communication::{UiHandle, UiReceivers},
        event::SessionEvent,
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
    cmd_tx: Sender<SessionCommand>,
    session_info: SessionInfo,
    receivers: UiReceivers,
    ui_state: SessionUiState,
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
            receivers,
            ui_state: SessionUiState::default(),
            logs_table: LogsTable::new(senders.cmd_tx.clone(), senders.block_cmd_tx.clone()),
            bottom_panel: BottomPanelUI::new(senders.cmd_tx.clone(), senders.block_cmd_tx),
            cmd_tx: senders.cmd_tx,
        }
    }

    pub fn get_info(&self) -> &SessionInfo {
        &self.session_info
    }

    pub fn close_session(&self, actions: &mut UiActions) {
        actions.try_send_command(&self.cmd_tx, SessionCommand::CloseSession);
    }

    pub fn render_content(&mut self, actions: &mut UiActions, ui: &mut Ui) {
        let Self {
            receivers,
            logs_table,
            bottom_panel,
            ui_state,
            ..
        } = self;
        let data = receivers.session_state_rx.borrow_and_update();

        TopBottomPanel::bottom("status_bar").show_inside(ui, |ui| {
            status_bar::render_content(&data, ui);
        });

        TopBottomPanel::bottom("bottom_panel")
            .height_range(100.0..=700.0)
            .default_height(200.)
            .resizable(true)
            .show_inside(ui, |ui| {
                ui.set_min_size(ui.available_size());
                bottom_panel.render_content(&data, ui_state, actions, ui);
            });

        CentralPanel::default().show_inside(ui, |ui| {
            // We need to give a unique id for the direct parent of each table because
            // they will be used as identifiers for table state to avoid ID clashes between
            // tables from different tabs (different sessions).
            ui.push_id(self.session_info.id, |ui| {
                logs_table.render_content(&data, ui_state, actions, ui);
            });
        });
    }

    /// Check incoming events and handle them.
    pub fn handle_events(&mut self) {
        while let Ok(event) = self.receivers.event_rx.try_recv() {
            match event {
                SessionEvent::NearestPosition(nearest_position) => {
                    self.ui_state.scroll_search_idx = Some(nearest_position.index);
                }
            }
        }
    }
}
