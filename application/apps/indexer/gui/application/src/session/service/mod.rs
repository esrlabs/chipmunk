use super::{command::SessionCommand, error::SessionError};

use super::communication::ServiceHandle;

#[derive(Debug)]
pub struct SessionService {
    communication: ServiceHandle,
}

impl SessionService {
    pub fn spwan(communication: ServiceHandle) {
        let session = Self { communication };

        tokio::spawn(async move {
            session.run().await;
        });
    }

    async fn run(mut self) {
        while let Some(cmd) = self.communication.cmd_rx.recv().await {
            if let Err(err) = self.handle_command(cmd).await {
                //TODO AAZ: Better error handling.
                log::error!("Error while handling session commands: {err:?}");
            }
        }
    }

    async fn handle_command(&mut self, cmd: SessionCommand) -> Result<(), SessionError> {
        match cmd {}

        Ok(())
    }
}
