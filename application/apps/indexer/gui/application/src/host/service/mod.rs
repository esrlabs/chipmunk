use crate::{
    host::{
        command::HostCommand, communication::ServiceHandle, error::HostError, event::HostEvent,
    },
    session::init_session,
};

#[derive(Debug)]
pub struct HostService {
    communication: ServiceHandle,
}

impl HostService {
    pub fn spawn(communication: ServiceHandle) {
        let host = Self { communication };

        tokio::spawn(async move {
            host.run().await;
        });
    }

    async fn run(mut self) {
        while let Some(cmd) = self.communication.cmd_rx.recv().await {
            if let Err(err) = self.handle_command(cmd).await {
                //TODO AAZ: Better error handling.
                log::error!("Error while handling host commands: {err:?}");
            }
        }
    }

    async fn handle_command(&mut self, cmd: HostCommand) -> Result<(), HostError> {
        match cmd {
            HostCommand::OpenFiles(files) => {
                log::trace!("Got open files request. Files: {files:?}");
                for file in files {
                    let session_info = init_session(file)?;

                    self.communication
                        .event_tx
                        .send(HostEvent::CreateSession(session_info))
                        .await
                        .map_err(|err| HostError::SendEvent(err.0))?;
                }
            }
            HostCommand::Close => {
                // Do any preparation before closing.
                self.communication
                    .event_tx
                    .send(HostEvent::Close)
                    .await
                    .map_err(|err| HostError::SendEvent(err.0))?;
            }
        }

        Ok(())
    }
}
