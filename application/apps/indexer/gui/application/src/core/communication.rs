use tokio::sync::{mpsc, watch};

use crate::{
    core::{commands::AppCommand, events::AppEvent},
    state::AppState,
};

const CHANNELS_CAPACITY: usize = 32;

#[derive(Debug)]
pub struct UiCommunication {
    pub senders: UiSenders,
    pub receivers: UiReceivers,
}

#[derive(Debug)]
pub struct UiSenders {
    pub cmd_tx: mpsc::Sender<AppCommand>,
}

#[derive(Debug)]
pub struct UiReceivers {
    pub event_rx: mpsc::Receiver<AppEvent>,
    pub app_state_rx: watch::Receiver<AppState>,
}

#[derive(Debug)]
pub struct CoreCommunication {
    pub cmd_rx: mpsc::Receiver<AppCommand>,
    pub event_tx: mpsc::Sender<AppEvent>,
    pub app_state_tx: watch::Sender<AppState>,
}

pub fn init() -> (UiCommunication, CoreCommunication) {
    let (cmd_tx, cmd_rx) = mpsc::channel(CHANNELS_CAPACITY);
    let (event_tx, event_rx) = mpsc::channel(CHANNELS_CAPACITY);
    let (app_state_tx, app_state_rx) = watch::channel(AppState::default());

    let senders = UiSenders { cmd_tx };

    let receivers = UiReceivers {
        event_rx,
        app_state_rx,
    };

    let ui_comm = UiCommunication { senders, receivers };

    let state_comm = CoreCommunication {
        cmd_rx,
        event_tx,
        app_state_tx,
    };

    (ui_comm, state_comm)
}
