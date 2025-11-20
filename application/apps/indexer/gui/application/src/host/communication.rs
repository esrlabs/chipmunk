use tokio::sync::mpsc;

use crate::{
    comm_utls::evaluate_send_res,
    host::{command::HostCommand, message::HostMessage, notification::AppNotification},
    session::communication::SharedSenders,
};

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
    pub message_rx: mpsc::Receiver<HostMessage>,
    pub notification_rx: mpsc::Receiver<AppNotification>,
}

/// Contains communication channels for the services to communicate with UI.
#[derive(Debug)]
pub struct ServiceHandle {
    pub cmd_rx: mpsc::Receiver<HostCommand>,
    pub senders: ServiceSenders,
}

/// Provide functions to send host messages and waking up the UI on them.
#[derive(Debug)]
pub struct ServiceSenders {
    message_tx: mpsc::Sender<HostMessage>,
    notification_tx: mpsc::Sender<AppNotification>,
    egui_ctx: egui::Context,
}

impl ServiceSenders {
    /// Send a message to the host UI and waking it up.
    ///
    /// # Return
    /// Returns `true` if the message is sent successfully. On send errors
    /// it will log the error and return `false`.
    pub async fn send_message(&self, message: HostMessage) -> bool {
        let res = self.message_tx.send(message).await;

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

    /// Create [`SharedSenders`] by cloning the needed internal channels.
    pub fn get_shared_senders(&self) -> SharedSenders {
        SharedSenders::new(
            self.message_tx.clone(),
            self.notification_tx.clone(),
            self.egui_ctx.clone(),
        )
    }
}

/// Initialize communication channels for host application.
pub fn init(egui_ctx: egui::Context) -> (UiHandle, ServiceHandle) {
    let (cmd_tx, cmd_rx) = mpsc::channel(CHANNELS_CAPACITY);
    let (message_tx, message_rx) = mpsc::channel(CHANNELS_CAPACITY);
    let (notification_tx, notification_rx) = mpsc::channel(CHANNELS_CAPACITY);

    let ui_senders = UiSenders { cmd_tx };

    let ui_receivers = UiReceivers {
        message_rx,
        notification_rx,
    };

    let ui_handle = UiHandle {
        senders: ui_senders,
        receivers: ui_receivers,
    };

    let service_senders = ServiceSenders {
        message_tx,
        notification_tx,
        egui_ctx,
    };

    let service_handle = ServiceHandle {
        cmd_rx,
        senders: service_senders,
    };

    (ui_handle, service_handle)
}
