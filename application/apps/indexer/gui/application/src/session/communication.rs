use tokio::sync::{
    mpsc::{self, error::SendError},
    watch,
};

use crate::{
    comm_utls::evaluate_send_res,
    host::{event::HostEvent, notification::AppNotification},
    session::{command::SessionCommand, data::SessionState, event::SessionEvent},
};

const CHANNELS_CAPACITY: usize = 32;

/// Represents the shared channels senders among host and session
/// communication members.
#[derive(Debug)]
pub struct SharedSenders {
    host_event_tx: mpsc::Sender<HostEvent>,
    notification_tx: mpsc::Sender<AppNotification>,
    egui_ctx: egui::Context,
}

impl SharedSenders {
    pub fn new(
        host_event_tx: mpsc::Sender<HostEvent>,
        notification_tx: mpsc::Sender<AppNotification>,
        egui_ctx: egui::Context,
    ) -> Self {
        Self {
            host_event_tx,
            notification_tx,
            egui_ctx,
        }
    }
}

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
    session_event_tx: mpsc::Sender<SessionEvent>,
    host_event_tx: mpsc::Sender<HostEvent>,
    notification_tx: mpsc::Sender<AppNotification>,
    session_state_tx: watch::Sender<SessionState>,
    egui_ctx: egui::Context,
}

impl ServiceSenders {
    /// Send session event to the session UI and wake it up.
    ///
    /// # Return
    /// Returns `true` if the event is sent successfully. On send errors
    /// it will log the error and return `false`.
    pub async fn send_session_event(&self, event: SessionEvent) -> bool {
        let res = self.session_event_tx.send(event).await;

        evaluate_send_res(&self.egui_ctx, res)
    }

    /// Send host event to the host UI and wake it up.
    ///
    /// # Return
    /// Returns `true` if the event is sent successfully. On send errors
    /// it will log the error and return `false`.
    pub async fn send_host_event(&self, event: HostEvent) -> bool {
        let res = self.host_event_tx.send(event).await;

        evaluate_send_res(&self.egui_ctx, res)
    }

    /// Send notification to host and waking up UI.
    ///
    /// # Return
    /// Returns `true` if the notification is sent successfully. On send errors
    /// it will log the error and return `false`.
    pub async fn send_notification(&self, notifi: AppNotification) -> bool {
        let res = self.notification_tx.send(notifi).await;

        evaluate_send_res(&self.egui_ctx, res)
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

#[derive(Debug)]
pub struct SessionCommunication {
    pub ui_handle: UiHandle,
    pub service_handle: ServiceHandle,
}

/// Initialize communication channels for session application.
pub fn init(shared_senders: SharedSenders, state: SessionState) -> (UiHandle, ServiceHandle) {
    let (cmd_tx, cmd_rx) = mpsc::channel(CHANNELS_CAPACITY);
    let (session_event_tx, session_event_rx) = mpsc::channel(CHANNELS_CAPACITY);
    let (session_state_tx, session_state_rx) = watch::channel(state);

    let ui_senders = UiSenders { cmd_tx };

    let ui_receivers = UiReceivers {
        event_rx: session_event_rx,
        session_state_rx,
    };

    let ui_comm = UiHandle {
        senders: ui_senders,
        receivers: ui_receivers,
    };

    let SharedSenders {
        host_event_tx,
        notification_tx,
        egui_ctx,
    } = shared_senders;

    let service_senders = ServiceSenders {
        session_event_tx,
        host_event_tx,
        notification_tx,
        session_state_tx,
        egui_ctx,
    };

    let state_comm = ServiceHandle {
        cmd_rx,
        senders: service_senders,
    };

    (ui_comm, state_comm)
}
