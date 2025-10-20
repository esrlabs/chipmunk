use tokio::sync::{mpsc, watch};

use crate::session::{command::SessionCommand, data::SessionState, event::SessionEvent};

const CHANNELS_CAPACITY: usize = 32;

/// Contains session communication channels for the UI to communicate with services.
#[derive(Debug)]
pub struct UiHandle {
    pub senders: UiSenders,
    pub receivers: UiReceivers,
}

#[derive(Debug)]
pub struct UiSenders {
    pub cmd_tx: mpsc::Sender<SessionCommand>,
}

#[derive(Debug)]
pub struct UiReceivers {
    pub event_rx: mpsc::Receiver<SessionEvent>,
    pub session_state_rx: watch::Receiver<SessionState>,
}

/// Contains session communication channels for the services to communicate with UI.
#[derive(Debug)]
pub struct ServiceHandle {
    pub cmd_rx: mpsc::Receiver<SessionCommand>,
    pub senders: ServiceSenders,
}

/// Provide functions to send event and update session state and waking up
/// the UI on each change
#[derive(Debug)]
pub struct ServiceSenders {
    event_tx: mpsc::Sender<SessionEvent>,
    session_state_tx: watch::Sender<SessionState>,
    egui_ctx: egui::Context,
}

impl ServiceSenders {
    /// Send an event to the session UI waking it up.
    pub async fn send_event(
        &self,
        event: SessionEvent,
    ) -> Result<(), mpsc::error::SendError<SessionEvent>> {
        self.event_tx.send(event).await?;
        self.egui_ctx.request_repaint();

        Ok(())
    }

    /// Modify session state with the provided `modify` function and notify
    /// the listeners waking up the UI only if modified.
    pub fn modify_state<F>(&self, modify: F) -> bool
    where
        F: FnOnce(&mut SessionState) -> bool,
    {
        let modified = self.session_state_tx.send_if_modified(modify);
        if modified {
            self.egui_ctx.request_repaint();
        }

        modified
    }
}

/// Initialize communication channels for session application.
pub fn init(egui_ctx: egui::Context, state: SessionState) -> (UiHandle, ServiceHandle) {
    let (cmd_tx, cmd_rx) = mpsc::channel(CHANNELS_CAPACITY);
    let (event_tx, event_rx) = mpsc::channel(CHANNELS_CAPACITY);
    let (session_state_tx, session_state_rx) = watch::channel(state);

    let ui_senders = UiSenders { cmd_tx };

    let ui_receivers = UiReceivers {
        event_rx,
        session_state_rx,
    };

    let ui_comm = UiHandle {
        senders: ui_senders,
        receivers: ui_receivers,
    };

    let service_senders = ServiceSenders {
        event_tx,
        session_state_tx,
        egui_ctx,
    };

    let state_comm = ServiceHandle {
        cmd_rx,
        senders: service_senders,
    };

    (ui_comm, state_comm)
}
