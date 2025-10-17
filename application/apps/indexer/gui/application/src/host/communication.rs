use tokio::sync::{mpsc, watch};

use crate::host::{command::HostCommand, data::HostState, event::HostEvent};

const CHANNELS_CAPACITY: usize = 32;

#[derive(Debug)]
pub struct UiCommunication {
    pub senders: UiSenders,
    pub receivers: UiReceivers,
}

#[derive(Debug)]
pub struct UiSenders {
    pub cmd_tx: mpsc::Sender<HostCommand>,
}

#[derive(Debug)]
pub struct UiReceivers {
    pub event_rx: mpsc::Receiver<HostEvent>,
    pub app_state_rx: watch::Receiver<HostState>,
}

#[derive(Debug)]
pub struct CoreCommunication {
    pub cmd_rx: mpsc::Receiver<HostCommand>,
    pub event_tx: mpsc::Sender<HostEvent>,
    pub app_state_tx: watch::Sender<HostState>,
}

pub fn init() -> (UiCommunication, CoreCommunication) {
    let (cmd_tx, cmd_rx) = mpsc::channel(CHANNELS_CAPACITY);
    let (event_tx, event_rx) = mpsc::channel(CHANNELS_CAPACITY);
    let (app_state_tx, app_state_rx) = watch::channel(HostState::default());

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
