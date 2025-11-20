use tokio::sync::mpsc;

use crate::{
    comm_utls::evaluate_send_res,
    host::{message::HostMessage, notification::AppNotification},
    session::{
        command::{SessionBlockingCommand, SessionCommand},
        message::SessionMessage,
    },
};

const CHANNELS_CAPACITY: usize = 32;

/// Represents the shared channels senders among host and session
/// communication members.
#[derive(Debug)]
pub struct SharedSenders {
    host_message_tx: mpsc::Sender<HostMessage>,
    notification_tx: mpsc::Sender<AppNotification>,
    egui_ctx: egui::Context,
}

impl SharedSenders {
    pub fn new(
        host_message_tx: mpsc::Sender<HostMessage>,
        notification_tx: mpsc::Sender<AppNotification>,
        egui_ctx: egui::Context,
    ) -> Self {
        Self {
            host_message_tx,
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
    pub block_cmd_tx: mpsc::Sender<SessionBlockingCommand>,
}

#[derive(Debug)]
pub struct UiReceivers {
    pub message_rx: mpsc::Receiver<SessionMessage>,
}

/// Contains session communication channels for the services to communicate with UI.
#[derive(Debug)]
pub struct ServiceHandle {
    pub cmd_rx: mpsc::Receiver<SessionCommand>,
    pub senders: ServiceSenders,
    pub block_communication: ServiceBlockCommuniaction,
}

/// Provide functions to send session messages and waking up the UI on them.
#[derive(Debug)]
pub struct ServiceSenders {
    session_msg_tx: mpsc::Sender<SessionMessage>,
    host_message_tx: mpsc::Sender<HostMessage>,
    notification_tx: mpsc::Sender<AppNotification>,
    egui_ctx: egui::Context,
}

impl ServiceSenders {
    /// Send session message to the session UI and wake it up.
    ///
    /// # Return
    /// Returns `true` if the message is sent successfully. On send errors
    /// it will log the error and return `false`.
    pub async fn send_session_msg(&self, msg: SessionMessage) -> bool {
        let res = self.session_msg_tx.send(msg).await;

        evaluate_send_res(&self.egui_ctx, res)
    }

    /// Send host message to the host UI and wake it up.
    ///
    /// # Return
    /// Returns `true` if the message is sent successfully. On send errors
    /// it will log the error and return `false`.
    pub async fn send_host_message(&self, message: HostMessage) -> bool {
        let res = self.host_message_tx.send(message).await;

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
}

/// Communication elements to be used in session service in the task
/// which will handle blocking commands sent from UI.
#[derive(Debug)]
pub struct ServiceBlockCommuniaction {
    pub block_cmd_rx: mpsc::Receiver<SessionBlockingCommand>,
    notification_tx: mpsc::Sender<AppNotification>,
    egui_ctx: egui::Context,
}

impl ServiceBlockCommuniaction {
    pub async fn send_notification(&self, notifi: AppNotification) -> bool {
        let res = self.notification_tx.send(notifi).await;

        evaluate_send_res(&self.egui_ctx, res)
    }
}

/// Initialize communication channels for session application.
pub fn init(shared_senders: SharedSenders) -> (UiHandle, ServiceHandle) {
    let (cmd_tx, cmd_rx) = mpsc::channel(CHANNELS_CAPACITY);
    let (block_cmd_tx, block_cmd_rx) = mpsc::channel(CHANNELS_CAPACITY);
    let (session_msg_tx, session_msg_rx) = mpsc::channel(CHANNELS_CAPACITY);

    let ui_senders = UiSenders {
        cmd_tx,
        block_cmd_tx,
    };

    let ui_receivers = UiReceivers {
        message_rx: session_msg_rx,
    };

    let ui_comm = UiHandle {
        senders: ui_senders,
        receivers: ui_receivers,
    };

    let SharedSenders {
        host_message_tx,
        notification_tx,
        egui_ctx,
    } = shared_senders;

    let service_senders = ServiceSenders {
        session_msg_tx,
        host_message_tx,
        notification_tx: notification_tx.clone(),
        egui_ctx: egui_ctx.clone(),
    };

    let block_communication = ServiceBlockCommuniaction {
        block_cmd_rx,
        notification_tx,
        egui_ctx,
    };

    let state_comm = ServiceHandle {
        cmd_rx,
        block_communication,
        senders: service_senders,
    };

    (ui_comm, state_comm)
}
