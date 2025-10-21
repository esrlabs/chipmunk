use uuid::Uuid;

use crate::host::event::HostEvent;
use crate::host::notification::AppNotification;

use super::{command::SessionCommand, error::SessionError};

use super::communication::ServiceHandle;

#[derive(Debug)]
pub struct SessionService {
    session_id: Uuid,
    communication: ServiceHandle,
}

impl SessionService {
    /// Spawn session service returning the session ID.
    pub fn spwan(communication: ServiceHandle) -> Uuid {
        let session_id = Uuid::new_v4();
        let session = Self {
            session_id,
            communication,
        };

        tokio::spawn(async move {
            session.run().await;
        });

        session_id
    }

    async fn run(mut self) {
        log::trace!("Start Session Service {}", self.session_id);

        while let Some(cmd) = self.communication.cmd_rx.recv().await {
            if let Err(error) = self.handle_command(cmd).await {
                log::error!("Error while handling session commands: {error:?}");

                let notifi = AppNotification::SessionError {
                    session_id: self.session_id,
                    error,
                };

                self.communication.senders.send_notification(notifi).await;
            }
        }

        log::trace!("Session Service {} has been dropped", self.session_id);
    }

    async fn handle_command(&mut self, cmd: SessionCommand) -> Result<(), SessionError> {
        match cmd {
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
}
