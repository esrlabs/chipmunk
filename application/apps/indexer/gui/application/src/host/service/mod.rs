use std::path::PathBuf;

use stypes::{FileFormat, ObserveOptions, ParserType};

use crate::{
    host::{
        command::HostCommand, communication::ServiceHandle, error::HostError, event::HostEvent,
        notification::AppNotification,
    },
    session::{InitSessionError, init_session},
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
                    .await;
            }
        }
    }

    async fn handle_command(&mut self, cmd: HostCommand) -> Result<(), HostError> {
        match cmd {
            HostCommand::OpenFiles(files) => {
                log::trace!("Got open files request. Files: {files:?}");

                for file in files {
                    self.open_file(file).await?;
                }
            }
            HostCommand::Close => {
                // Do any preparation before closing.
                self.communication
                    .senders
                    .send_event(HostEvent::Close)
                    .await;
            }
        }

        Ok(())
    }

    async fn open_file(&mut self, file_path: PathBuf) -> Result<(), HostError> {
        log::trace!("Opening file: {}", file_path.display());

        let is_binary =
            file_tools::is_binary(&file_path).map_err(|err| InitSessionError::IO(err))?;

        if is_binary {
            return Err(HostError::InitSessionError(InitSessionError::Other(
                "Binary files aren't supported yet".into(),
            )));
        }

        let origin = ObserveOptions::file(file_path, FileFormat::Text, ParserType::Text(()));

        let session_info =
            init_session(self.communication.senders.get_shared_senders(), origin).await?;

        self.communication
            .senders
            .send_event(HostEvent::CreateSession(session_info))
            .await;

        //TODO AAZ: Remove after prototyping.
        self.communication
            .senders
            .send_notification(AppNotification::Info(String::from(
                "TODO DEBUG: Session created for file",
            )))
            .await;
        Ok(())
    }
}
