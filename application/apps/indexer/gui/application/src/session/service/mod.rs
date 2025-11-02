use tokio::select;
use tokio::sync::mpsc;
use uuid::Uuid;

use session_core::session::Session;
use stypes::{CallbackEvent, ObserveOptions};

use crate::host::event::HostEvent;
use crate::host::notification::AppNotification;
use crate::session::InitSessionError;
use crate::session::info::SessionInfo;

use super::{command::SessionCommand, error::SessionError};

use super::communication::ServiceHandle;

#[derive(Debug)]
pub struct SessionService {
    session_id: Uuid,
    communication: ServiceHandle,
    session: Session,
    callback_rx: mpsc::UnboundedReceiver<CallbackEvent>,
}

impl SessionService {
    /// Spawn session service returning the session ID.
    pub async fn spwan(
        communication: ServiceHandle,
        options: ObserveOptions,
    ) -> Result<SessionInfo, InitSessionError> {
        let session_id = Uuid::new_v4();
        let (session, callback_rx) = session_core::session::Session::new(session_id).await?;

        let session_info = SessionInfo::from_observe_options(session_id, &options);

        session.observe(Uuid::new_v4(), options)?;

        let service = Self {
            session_id,
            communication,
            session,
            callback_rx,
        };

        tokio::spawn(async move {
            service.run().await;
        });

        Ok(session_info)
    }

    async fn run(mut self) {
        log::trace!("Start Session Service {}", self.session_id);

        loop {
            select! {
                Some(cmd) = self.communication.cmd_rx.recv() => {
                    if let Err(error) = self.handle_command(cmd).await {
                        log::error!("Error while handling session commands: {error:?}");
                        self.send_error(error).await;
                    }
                },
                // Callback receiver won't be dropped when session is dropped.
                Some(event) = self.callback_rx.recv() => {
                    if let Err(error)= self.handle_callbacks(event).await {
                        log::error!("Error while handling session callback event: {error:?}");
                        self.send_error(error).await;
                    }
                }
                 else => { break; }
            }
        }

        log::trace!("Session Service {} has been dropped", self.session_id);

        //TODO AAZ: Session isn't dropped automatically because of callback receiver.
        println!(
            "****** Session Service {} has been dropped",
            self.session_id
        );
    }

    async fn send_error(&self, error: SessionError) {
        let notifi = AppNotification::SessionError {
            session_id: self.session_id,
            error,
        };

        self.communication.senders.send_notification(notifi).await;
    }

    async fn handle_command(&mut self, cmd: SessionCommand) -> Result<(), SessionError> {
        match cmd {
            SessionCommand::GrabLines(grab_range) => {
                let elements = self.session.grab(grab_range).await?;
                self.communication.senders.modify_state(|data| {
                    data.main_table.append(elements.0);
                    true
                });
            }
            SessionCommand::ApplySearchFilter(search_filters) => {
                self.session
                    .apply_search_filters(Uuid::new_v4(), search_filters)?;
            }
            SessionCommand::DropSearch => {
                self.session.drop_search().await?;
            }
            SessionCommand::CloseSession => {
                self.communication
                    .senders
                    .send_host_event(HostEvent::CloseSession {
                        session_id: self.session_id,
                    })
                    .await;
            }
        }

        Ok(())
    }

    async fn handle_callbacks(&mut self, event: CallbackEvent) -> Result<(), SessionError> {
        println!("************** DEBUG: Received callback: {event}");

        log::trace!(
            "Received callback. Session: {}. Event: {}",
            self.session_id,
            event
        );
        match event {
            CallbackEvent::StreamUpdated(logs_count) => {
                self.communication.senders.modify_state(|state| {
                    state.logs_count = logs_count;
                    true
                });
            }
            event => {
                log::warn!("Unhandled callback: {event}");
            }
        }

        Ok(())
    }
}
