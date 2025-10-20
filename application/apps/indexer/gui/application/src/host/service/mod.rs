use crate::{
    host::{
        command::HostCommand, communication::ServiceHandle, error::HostError, event::HostEvent,
        notification::AppNotification,
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
                self.communication
                    .senders
                    .send_notification(AppNotification::HostError(err))
                    .await
                    .inspect_err(|err| log::error!("Communication Error {err}"))
                    .ok();
            }
        }
    }

    async fn handle_command(&mut self, cmd: HostCommand) -> Result<(), HostError> {
        match cmd {
            HostCommand::OpenFiles(files) => {
                log::trace!("Got open files request. Files: {files:?}");
                for file in files {
                    let file_display = file.display().to_string();
                    let session_info =
                        init_session(self.communication.senders.get_shared_senders(), file)?;

                    self.communication
                        .senders
                        .send_event(HostEvent::CreateSession(session_info))
                        .await
                        .map_err(|err| HostError::SendEvent(err.0))?;

                    self.communication
                        .senders
                        .send_notification(AppNotification::Info(format!(
                            "Session created for file {file_display}"
                        )))
                        .await
                        .inspect_err(|err| log::error!("Communication Error. {err}"))
                        .ok();
                }
            }
            HostCommand::Close => {
                // Do any preparation before closing.
                self.communication
                    .senders
                    .send_event(HostEvent::Close)
                    .await
                    .map_err(|err| HostError::SendEvent(err.0))?;
            }
        }

        Ok(())
    }
}
