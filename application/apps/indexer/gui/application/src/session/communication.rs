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
    pub event_tx: mpsc::Sender<SessionEvent>,
    pub session_state_tx: watch::Sender<SessionState>,
}

/// Initialize communication channels for session application.
pub fn init(state: SessionState) -> (UiHandle, ServiceHandle) {
    let (cmd_tx, cmd_rx) = mpsc::channel(CHANNELS_CAPACITY);
    let (event_tx, event_rx) = mpsc::channel(CHANNELS_CAPACITY);
    let (session_state_tx, session_state_rx) = watch::channel(state);

    let senders = UiSenders { cmd_tx };

    let receivers = UiReceivers {
        event_rx,
        session_state_rx,
    };

    let ui_comm = UiHandle { senders, receivers };

    let state_comm = ServiceHandle {
        cmd_rx,
        event_tx,
        session_state_tx,
    };

    (ui_comm, state_comm)
}
