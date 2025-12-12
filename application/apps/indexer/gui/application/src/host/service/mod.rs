use std::{ops::Not, os::unix::fs::MetadataExt, path::PathBuf, thread};

use stypes::{DltParserSettings, FileFormat, ObserveOptions, ObserveOrigin, ParserType};
use tokio::runtime::Handle;
use uuid::Uuid;

use crate::{
    host::{
        command::HostCommand,
        common::{
            parsers::{DltParserConfig, ParserConfig, ParserNames},
            sources::{ByteSourceType, SourceFileInfo},
        },
        communication::ServiceHandle,
        error::HostError,
        message::HostMessage,
        notification::AppNotification,
        ui::session_setup::SessionSetupState,
    },
    session::{InitSessionError, init_session},
};

#[derive(Debug)]
pub struct HostService {
    communication: ServiceHandle,
}

impl HostService {
    /// Spawns tokio runtime to run host services returning a handle of the runtime.
    #[must_use]
    pub fn spawn(communication: ServiceHandle) -> Handle {
        let host = Self { communication };

        let (handle_tx, handle_rx) = std::sync::mpsc::channel();

        thread::spawn(move || {
            let rt = tokio::runtime::Builder::new_multi_thread()
                .enable_all()
                .build()
                .expect("Spawning tokio runtime failed");

            handle_tx
                .send(rt.handle().clone())
                .expect("Sending tokio handle should never fail");

            rt.block_on(async {
                host.run().await;
            });
        });

        handle_rx
            .recv()
            .expect("Receiving tokio handle should never fail")
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
            HostCommand::StartSession {
                session_setup_id,
                parser,
                source,
            } => {
                self.start_session(session_setup_id, source, parser).await?;
            }
            HostCommand::CloseSessionSetup(id) => {
                // NOTE: We need to checks here for cleaning up session setups (Like cancelling
                // DLT statistics process).
                self.communication
                    .senders
                    .send_message(HostMessage::SessionSetupClosed { id })
                    .await;
            }
            HostCommand::Close => {
                // Do any preparation before closing.
                self.communication
                    .senders
                    .send_message(HostMessage::Shutdown)
                    .await;
            }
        }

        Ok(())
    }

    async fn open_file(&mut self, file_path: PathBuf) -> Result<(), HostError> {
        log::trace!("Opening file: {}", file_path.display());

        let is_binary = file_tools::is_binary(&file_path).map_err(InitSessionError::IO)?;

        if is_binary {
            let extension = file_path.extension();
            // Open session setup view for binary files.
            let format = match extension {
                Some(ext) if ext.eq_ignore_ascii_case("pcap") => FileFormat::PcapLegacy,
                Some(ext) if ext.eq_ignore_ascii_case("pcapng") => FileFormat::PcapNG,
                _ => FileFormat::Binary,
            };

            let name = file_path
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_else(|| String::from("Unknown"));

            let size_bytes = std::fs::metadata(&file_path)
                .map_err(InitSessionError::IO)?
                .size();
            let size_txt = format_file_size(size_bytes);

            let parser = match format {
                FileFormat::PcapNG | FileFormat::PcapLegacy => ParserConfig::SomeIP,
                FileFormat::Text => ParserConfig::Text,
                FileFormat::Binary => {
                    if extension.is_some_and(|ext| ext.eq_ignore_ascii_case("dlt")) {
                        ParserConfig::Dlt(DltParserConfig::new(true))
                    } else {
                        return Err(HostError::InitSessionError(InitSessionError::Other(
                            "File extension is not supported".to_owned(),
                        )));
                    }
                }
            };

            let file_info = SourceFileInfo::new(file_path, name, size_txt, format);
            let source_type = ByteSourceType::File(file_info);

            let supported_parsers = ParserNames::all()
                .iter()
                .filter(|f| f.support_binary_files())
                .copied()
                .collect();

            let session_setup =
                SessionSetupState::new(Uuid::new_v4(), source_type, parser, supported_parsers);

            self.communication
                .senders
                .send_message(HostMessage::SessionSetupOpened(session_setup))
                .await;
        } else {
            // Start sessions directly for text files.
            let origin = ObserveOptions::file(file_path, FileFormat::Text, ParserType::Text(()));

            let session_info =
                init_session(self.communication.senders.get_shared_senders(), origin).await?;

            self.communication
                .senders
                .send_message(HostMessage::SessionCreated {
                    session_info,
                    session_setup_id: None,
                })
                .await;
        }

        Ok(())
    }

    async fn start_session(
        &self,
        session_setup_id: Uuid,
        source: ByteSourceType,
        parser: ParserConfig,
    ) -> Result<(), HostError> {
        let session_id = Uuid::new_v4();
        let origin = match source {
            ByteSourceType::File(source_file_info) => ObserveOrigin::File(
                session_id.to_string(),
                source_file_info.format,
                source_file_info.path,
            ),
        };

        let parser = match parser {
            ParserConfig::Dlt(config) => {
                let fibex_file_paths = config.fibex_files.is_empty().not().then(|| {
                    config
                        .fibex_files
                        .into_iter()
                        .map(|p| p.path.to_string_lossy().to_string())
                        .collect()
                });

                let dlt_config = DltParserSettings {
                    filter_config: None,
                    fibex_file_paths,
                    with_storage_header: config.with_storage_header,
                    tz: config.timezone,
                    fibex_metadata: None,
                };

                ParserType::Dlt(dlt_config)
            }
            ParserConfig::SomeIP | ParserConfig::Text | ParserConfig::Plugins => {
                let parser_name = ParserNames::from(&parser);
                return Err(HostError::InitSessionError(InitSessionError::Other(
                    format!("Parser {parser_name:} isn't supported yet"),
                )));
            }
        };

        let origin = ObserveOptions { origin, parser };

        let session_info =
            init_session(self.communication.senders.get_shared_senders(), origin).await?;

        self.communication
            .senders
            .send_message(HostMessage::SessionCreated {
                session_info,
                session_setup_id: Some(session_setup_id),
            })
            .await;

        Ok(())
    }
}

fn format_file_size(bytes: u64) -> String {
    const KB: u64 = 1024;
    const MB: u64 = 1024 * KB;
    const GB: u64 = 1024 * MB;

    if bytes < KB {
        format!("{} B", bytes)
    } else if bytes < MB {
        format!("{:.2} KB", bytes as f64 / KB as f64)
    } else if bytes < GB {
        format!("{:.2} MB", bytes as f64 / MB as f64)
    } else {
        format!("{:.2} GB", bytes as f64 / GB as f64)
    }
}
