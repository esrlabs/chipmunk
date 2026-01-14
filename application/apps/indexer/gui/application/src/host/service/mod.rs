use std::{ops::Not, path::PathBuf, thread};

use stypes::{
    DltParserSettings, FileFormat, ObserveOptions, ObserveOrigin, ParserType, SomeIpParserSettings,
    Transport,
};
use tokio::runtime::Handle;
use uuid::Uuid;

use crate::{
    host::{
        command::{HostCommand, StartSessionParam},
        common::{parsers::ParserNames, sources::StreamNames},
        communication::ServiceHandle,
        error::HostError,
        message::HostMessage,
        notification::AppNotification,
        ui::session_setup::state::{
            SessionSetupState,
            parsers::{DltParserConfig, ParserConfig, someip::SomeIpParserConfig},
            sources::{
                ByteSourceConfig, ProcessConfig, SerialConfig, SourceFileInfo, StreamConfig,
                TcpConfig, UdpConfig,
            },
        },
    },
    session::{InitSessionError, service::SessionService},
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
            HostCommand::ConnectionSessionSetup { stream, parser } => {
                self.connection_session_setup(stream, parser).await
            }
            HostCommand::StartSession(start_params) => {
                let StartSessionParam {
                    parser,
                    source,
                    session_setup_id,
                } = *start_params;

                self.start_session(source, parser, session_setup_id).await?;
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

    async fn open_file(&self, file_path: PathBuf) -> Result<(), HostError> {
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
                .len();
            let size_txt = format_file_size(size_bytes);

            let parser = match format {
                FileFormat::PcapNG | FileFormat::PcapLegacy => {
                    ParserConfig::SomeIP(SomeIpParserConfig::new())
                }
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
            let source_type = ByteSourceConfig::File(file_info);

            let session_setup = SessionSetupState::new(Uuid::new_v4(), source_type, parser);

            self.communication
                .senders
                .send_message(HostMessage::SessionSetupOpened(session_setup))
                .await;
        } else {
            // Start sessions directly for text files.
            let origin = ObserveOptions::file(file_path, FileFormat::Text, ParserType::Text(()));

            let session_params =
                SessionService::spawn(self.communication.senders.get_shared_senders(), origin)
                    .await?;

            self.communication
                .senders
                .send_message(HostMessage::SessionCreated {
                    session_params,
                    session_setup_id: None,
                })
                .await;
        }

        Ok(())
    }

    async fn connection_session_setup(&self, stream: StreamNames, parser: ParserNames) {
        let source_type = match stream {
            StreamNames::Process => {
                ByteSourceConfig::Stream(StreamConfig::Process(ProcessConfig::new()))
            }
            StreamNames::Tcp => ByteSourceConfig::Stream(StreamConfig::Tcp(TcpConfig::new())),
            StreamNames::Udp => ByteSourceConfig::Stream(StreamConfig::Udp(UdpConfig::new())),
            StreamNames::Serial => {
                ByteSourceConfig::Stream(StreamConfig::Serial(SerialConfig::new()))
            }
        };

        let parser = match parser {
            ParserNames::Dlt => ParserConfig::Dlt(DltParserConfig::new(false)),
            ParserNames::SomeIP => ParserConfig::SomeIP(SomeIpParserConfig::default()),
            ParserNames::Text => ParserConfig::Text,
            ParserNames::Plugins => todo!(),
        };

        let session_setup = SessionSetupState::new(Uuid::new_v4(), source_type, parser);

        self.communication
            .senders
            .send_message(HostMessage::SessionSetupOpened(session_setup))
            .await;
    }

    async fn start_session(
        &self,
        source: ByteSourceConfig,
        parser: ParserConfig,
        session_setup_id: Option<Uuid>,
    ) -> Result<(), HostError> {
        let source_id = Uuid::new_v4().to_string();
        let origin = match source {
            ByteSourceConfig::File(source_file_info) => {
                ObserveOrigin::File(source_id, source_file_info.format, source_file_info.path)
            }
            ByteSourceConfig::Stream(StreamConfig::Process(config)) => {
                ObserveOrigin::Stream(source_id, Transport::Process(config.into()))
            }
            ByteSourceConfig::Stream(StreamConfig::Tcp(config)) => {
                ObserveOrigin::Stream(source_id, Transport::TCP(config.into()))
            }
            ByteSourceConfig::Stream(StreamConfig::Udp(config)) => {
                ObserveOrigin::Stream(source_id, Transport::UDP(config.into()))
            }
            ByteSourceConfig::Stream(StreamConfig::Serial(config)) => {
                ObserveOrigin::Stream(source_id, Transport::Serial(config.into()))
            }
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
            ParserConfig::SomeIP(config) => {
                let fibex_file_paths = config.fibex_files.is_empty().not().then(|| {
                    config
                        .fibex_files
                        .into_iter()
                        .map(|p| p.path.to_string_lossy().to_string())
                        .collect()
                });

                let someip_settings = SomeIpParserSettings { fibex_file_paths };

                ParserType::SomeIp(someip_settings)
            }
            ParserConfig::Text => ParserType::Text(()),
            ParserConfig::Plugins => {
                let parser_name = ParserNames::from(&parser);
                return Err(HostError::InitSessionError(InitSessionError::Other(
                    format!("Parser {parser_name:} isn't supported yet"),
                )));
            }
        };

        let origin = ObserveOptions { origin, parser };

        let session_params =
            SessionService::spawn(self.communication.senders.get_shared_senders(), origin).await?;

        self.communication
            .senders
            .send_message(HostMessage::SessionCreated {
                session_params,
                session_setup_id,
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
