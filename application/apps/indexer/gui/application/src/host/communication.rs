use tokio::sync::{mpsc, watch};

use crate::host::{command::HostCommand, data::HostState, event::HostEvent};

const CHANNELS_CAPACITY: usize = 32;

/// Contains host communication channels for the UI to communicate with services.
#[derive(Debug)]
pub struct UiHandle {
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
    pub host_state_rx: watch::Receiver<HostState>,
}

/// Contains communication channels for the services to communicate with UI.
#[derive(Debug)]
pub struct ServiceHandle {
    pub cmd_rx: mpsc::Receiver<HostCommand>,
    pub event_tx: mpsc::Sender<HostEvent>,
    pub host_state_tx: watch::Sender<HostState>,
}

/// Initialize communication channels for host application.
pub fn init(state: HostState) -> (UiHandle, ServiceHandle) {
    let (cmd_tx, cmd_rx) = mpsc::channel(CHANNELS_CAPACITY);
    let (event_tx, event_rx) = mpsc::channel(CHANNELS_CAPACITY);
    let (host_state_tx, host_state_rx) = watch::channel(state);

    let senders = UiSenders { cmd_tx };

    let receivers = UiReceivers {
        event_rx,
        host_state_rx,
    };

    let ui_handle = UiHandle { senders, receivers };

    let service_handle = ServiceHandle {
        cmd_rx,
        event_tx,
        host_state_tx,
    };

    (ui_handle, service_handle)
}
