use egui::Ui;
use state::SessionUiState;
use uuid::Uuid;

use crate::session::{
    InitSessionParams,
    command::SessionCommand,
    communication::{UiHandle, UiReceivers, UiSenders},
};

mod state;

#[derive(Debug)]
pub struct SessionInfo {
    pub id: Uuid,
    pub title: String,
}

#[derive(Debug)]
pub struct SessionUI {
    session_info: SessionInfo,
    senders: UiSenders,
    receivers: UiReceivers,
    state: SessionUiState,
}

impl SessionUI {
    pub fn new(init: InitSessionParams) -> Self {
        let UiHandle { senders, receivers } = init.communication;

        let title = init
            .file_path
            .file_name()
            .map(|name| name.to_string_lossy().to_string())
            .unwrap_or_else(|| String::from("Unknown"));

        let session_info = SessionInfo {
            id: init.session_id,
            title,
        };

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

    pub fn close_session(&self) {
        self.senders
            .cmd_tx
            .try_send(SessionCommand::CloseSession)
            .inspect_err(|err| {
                //TODO AAZ: Better error handling.
                log::error!("Error while sending clsoe message. {err}");
            })
            .ok();
    }

    pub fn render_content(&mut self, ui: &mut Ui) {
        let data = self.receivers.session_state_rx.borrow_and_update();
        egui::ScrollArea::vertical().show(ui, |ui| {
            for (idx, line) in data.content_lines.iter().enumerate() {
                ui.label(format!("{idx}: {line}"));
            }
        });
    }

    /// Check incoming events and handle them.
    pub fn handle_events(&mut self) {
        while let Ok(event) = self.receivers.event_rx.try_recv() {
            match event {}
        }
    }
}
