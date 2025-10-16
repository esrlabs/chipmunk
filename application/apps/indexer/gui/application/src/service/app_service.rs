use crate::core::{
    CoreError, commands::AppCommand, communication::CoreCommunication, events::AppEvent,
};

#[derive(Debug)]
pub struct AppService {
    communication: CoreCommunication,
}

impl AppService {
    pub fn spawn(communication: CoreCommunication) {
        let mut state = Self { communication };

        tokio::spawn(async move {
            state.run().await;
        });
    }

    async fn run(&mut self) {
        while let Some(cmd) = self.communication.cmd_rx.recv().await {
            if let Err(err) = self.handle_command(cmd).await {
                //TODO AAZ: Better error handling.
                log::error!("Error while handling app commands: {err:?}");
            }
        }
    }

    async fn handle_command(&mut self, cmd: AppCommand) -> Result<(), CoreError> {
        match cmd {
            AppCommand::OpenFiles(files) => {
                log::trace!("Got open files request. Files: {files:?}");
                for file in files {
                    let title = file
                        .file_name()
                        .map(|name| name.to_string_lossy().to_string())
                        .unwrap_or_else(|| String::from("Unknown"));
                    self.communication
                        .event_tx
                        .send(AppEvent::CreateSession { title })
                        .await
                        .map_err(|err| CoreError::SendEvent(err.0))?;
                }
            }
            AppCommand::Close => {
                // Do any preparation before closing.
                self.communication
                    .event_tx
                    .send(AppEvent::Close)
                    .await
                    .map_err(|err| CoreError::SendEvent(err.0))?;
            }
        }

        Ok(())
    }
}
