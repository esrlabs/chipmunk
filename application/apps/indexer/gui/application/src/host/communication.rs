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
    pub senders: ServiceSenders,
}

/// Provide functions to send event and update host state and waking up
/// the UI on each change
#[derive(Debug)]
pub struct ServiceSenders {
    event_tx: mpsc::Sender<HostEvent>,
    host_state_tx: watch::Sender<HostState>,
    egui_ctx: egui::Context,
}

impl ServiceSenders {
    /// Send an event to the host UI and waking it up.
    pub async fn send_event(
        &self,
        event: HostEvent,
    ) -> Result<(), mpsc::error::SendError<HostEvent>> {
        self.event_tx.send(event).await?;
        self.egui_ctx.request_repaint();

        Ok(())
    }

    /// Modify host state with the provided `modify` function and notify
    /// the listeners waking up the UI only if modified.
    pub fn modify_state<F>(&self, modify: F) -> bool
    where
        F: FnOnce(&mut HostState) -> bool,
    {
        let modified = self.host_state_tx.send_if_modified(modify);
        if modified {
            self.egui_ctx.request_repaint();
        }

        modified
    }
}

/// Initialize communication channels for host application.
pub fn init(egui_ctx: egui::Context, state: HostState) -> (UiHandle, ServiceHandle) {
    let (cmd_tx, cmd_rx) = mpsc::channel(CHANNELS_CAPACITY);
    let (event_tx, event_rx) = mpsc::channel(CHANNELS_CAPACITY);
    let (host_state_tx, host_state_rx) = watch::channel(state);

    let ui_senders = UiSenders { cmd_tx };

    let ui_receivers = UiReceivers {
        event_rx,
        host_state_rx,
    };

    let ui_handle = UiHandle {
        senders: ui_senders,
        receivers: ui_receivers,
    };

    let service_senders = ServiceSenders {
        event_tx,
        host_state_tx,
        egui_ctx,
    };

    let service_handle = ServiceHandle {
        cmd_rx,
        senders: service_senders,
    };

    (ui_handle, service_handle)
}
