use std::{
    collections::HashMap,
    ops::Not,
    path::{Path, PathBuf},
    thread,
};

use anyhow::Result;
use itertools::Itertools;
use tokio::runtime::Handle;
use uuid::Uuid;

use stypes::{
    DltParserSettings, FileFormat, ObserveOptions, ObserveOrigin, ParserType, SomeIpParserSettings,
    Transport,
};

use crate::{
    host::{
        command::{HostCommand, StartSessionParam},
        common::{parsers::ParserNames, sources::StreamNames},
        communication::ServiceHandle,
        error::HostError,
        message::HostMessage,
        notification::AppNotification,
        ui::{
            multi_setup::state::MultiFileState,
            session_setup::state::{
                SessionSetupState,
                parsers::{DltParserConfig, ParserConfig, someip::SomeIpParserConfig},
                sources::{
                    ByteSourceConfig, ProcessConfig, SerialConfig, SourceFileInfo, StreamConfig,
                    TcpConfig, UdpConfig,
                },
            },
        },
    },
    session::{InitSessionError, service::SessionService},
};

mod file;

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
                self.send_host_err(err).await;
            }
        }
    }

    async fn handle_command(&mut self, cmd: HostCommand) -> Result<(), HostError> {
        match cmd {
            HostCommand::OpenFiles(files) => {
                log::trace!("Got open files request. Files: {files:?}");

                if files.len() == 1 {
                    self.open_single_file(files.into_iter().next().unwrap())
                        .await?;
                } else {
                    self.open_multi_files(files).await?;
                }
            }
            HostCommand::OpenAsSessions(files) => {
                for file in files {
                    if let Err(err) = self.open_single_file(file).await {
                        self.send_host_err(err).await;
                    }
                }
            }
            HostCommand::OpenFromDirectory {
                dir_path,
                target_format,
            } => self.files_in_dir(dir_path, target_format).await?,

            HostCommand::ConcatFiles(files) => self.concatenate_files(files).await?,
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
            HostCommand::CloseMultiSetup(id) => {
                // Preparation for close goes here.
                self.communication
                    .senders
                    .send_message(HostMessage::MultiSetupClose { id })
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

    async fn open_single_file(&self, file_path: PathBuf) -> Result<(), HostError> {
        log::trace!("Opening file: {}", file_path.display());

        let format = file::get_file_format(&file_path).map_err(InitSessionError::IO)?;
        let parser = match format {
            FileFormat::PcapNG | FileFormat::PcapLegacy => {
                ParserConfig::SomeIP(SomeIpParserConfig::new())
            }
            FileFormat::Text => ParserConfig::Text,
            FileFormat::Binary => {
                if Self::is_dlt_file(&file_path) {
                    ParserConfig::Dlt(DltParserConfig::new(true))
                } else {
                    return Err(HostError::InitSessionError(InitSessionError::Other(
                        format!(
                            "File extension is not supported for file: {}",
                            file_path.display()
                        ),
                    )));
                }
            }
        };

        let need_session_setup = !matches!(parser, ParserConfig::Text);

        if need_session_setup {
            let file_info = SourceFileInfo::new(file_path, format);
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

    pub async fn open_multi_files(&self, paths: Vec<PathBuf>) -> Result<(), HostError> {
        let files = tokio::task::spawn_blocking(move || {
            paths
                .into_iter()
                .filter_map(|path| {
                    file::get_file_format(&path)
                        .inspect_err(|err| {
                            log::warn!(
                                "Error while checking file type. File will be skipped. \
                                Path: {}. Error {err:?}",
                                path.display()
                            )
                        })
                        .ok()
                        .map(|format| (path, format))
                })
                .collect_vec()
        })
        .await
        .map_err(|_| {
            HostError::InitSessionError(InitSessionError::Other(
                "Determining file types failed.".into(),
            ))
        })?;

        let state = MultiFileState::new(files);

        self.communication
            .senders
            .send_message(HostMessage::MultiFilesSetup(state))
            .await;

        Ok(())
    }

    /// Scan the files in directory and open the files of the given type
    async fn files_in_dir(&self, dir_path: PathBuf, format: FileFormat) -> Result<(), HostError> {
        let files = tokio::task::spawn_blocking(move || file::scan_dir(&dir_path, format))
            .await
            .map_err(|_| {
                HostError::InitSessionError(InitSessionError::Other(
                    "Background task failed".into(),
                ))
            })?
            .map_err(|err| HostError::InitSessionError(InitSessionError::IO(err)))?;

        if files.is_empty() {
            self.communication
                .senders
                .send_notification(AppNotification::Info("No files has been found".into()))
                .await;

            return Ok(());
        }

        if files.len() == 1 {
            return self
                .open_single_file(files.into_iter().next().unwrap())
                .await;
        }

        let files = files.into_iter().map(|path| (path, format)).collect_vec();

        let state = MultiFileState::new(files);
        let msg = HostMessage::MultiFilesSetup(state);

        self.communication.senders.send_message(msg).await;

        Ok(())
    }

    async fn concatenate_files(&self, files: Vec<(PathBuf, FileFormat)>) -> Result<(), HostError> {
        let mut file_groups = HashMap::new();

        for (path, format) in files {
            file_groups
                .entry(format)
                .or_insert_with(Vec::new)
                .push(path);
        }

        for (format, mut files) in file_groups.into_iter() {
            if files.len() == 1 {
                log::trace!("Concat: Only one file with format {format}");
                if let Err(err) = self
                    .open_single_file(files.into_iter().next().unwrap())
                    .await
                {
                    self.send_host_err(err).await;
                }
                continue;
            }

            let parser = match format {
                FileFormat::PcapNG | FileFormat::PcapLegacy => {
                    ParserConfig::SomeIP(SomeIpParserConfig::new())
                }
                FileFormat::Text => ParserConfig::Text,
                FileFormat::Binary => {
                    // Validate files for binary since only DLT is supported.
                    let (valid, invalid): (Vec<_>, Vec<_>) =
                        files.drain(..).partition(|path| Self::is_dlt_file(path));
                    files = valid;

                    // Notify for unsupported files.
                    for path in invalid {
                        let err = HostError::InitSessionError(InitSessionError::Other(format!(
                            "File extension is not supported for file: {}",
                            path.display()
                        )));
                        self.send_host_err(err).await;
                    }

                    // Check edge cases after validation.
                    match files.len() {
                        0 => {
                            log::debug!("Concat Binary: No valid files after validation. Skipping");
                            continue;
                        }
                        1 => {
                            log::debug!("Concat Binary: One valid file after validation.");
                            if let Err(err) = self
                                .open_single_file(files.into_iter().next().unwrap())
                                .await
                            {
                                self.send_host_err(err).await;
                            }
                            continue;
                        }
                        _ => {}
                    }
                    ParserConfig::Dlt(DltParserConfig::new(true))
                }
            };

            match parser {
                ParserConfig::Dlt(..) | ParserConfig::SomeIP(..) => {
                    let files = files
                        .into_iter()
                        .map(|path| SourceFileInfo::new(path, format))
                        .collect_vec();

                    let source_type = ByteSourceConfig::Concat(files);

                    let session_setup = SessionSetupState::new(Uuid::new_v4(), source_type, parser);

                    self.communication
                        .senders
                        .send_message(HostMessage::SessionSetupOpened(session_setup))
                        .await;
                }
                ParserConfig::Text => {
                    let files = files
                        .into_iter()
                        .map(|path| (Uuid::new_v4().to_string(), format, path))
                        .collect_vec();

                    let origin = ObserveOptions {
                        origin: ObserveOrigin::Concat(files),
                        parser: ParserType::Text(()),
                    };

                    let session_params = match SessionService::spawn(
                        self.communication.senders.get_shared_senders(),
                        origin,
                    )
                    .await
                    {
                        Ok(params) => params,
                        Err(err) => {
                            self.send_host_err(err.into()).await;
                            continue;
                        }
                    };

                    self.communication
                        .senders
                        .send_message(HostMessage::SessionCreated {
                            session_params,
                            session_setup_id: None,
                        })
                        .await;
                }
                ParserConfig::Plugins => todo!(),
            }
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
        let origin = match source {
            ByteSourceConfig::File(source_file_info) => ObserveOrigin::File(
                Uuid::new_v4().to_string(),
                source_file_info.format,
                source_file_info.path,
            ),
            ByteSourceConfig::Concat(files) => ObserveOrigin::Concat(
                files
                    .into_iter()
                    .map(|file| (Uuid::new_v4().to_string(), file.format, file.path))
                    .collect(),
            ),
            ByteSourceConfig::Stream(StreamConfig::Process(config)) => ObserveOrigin::Stream(
                Uuid::new_v4().to_string(),
                Transport::Process(config.into()),
            ),
            ByteSourceConfig::Stream(StreamConfig::Tcp(config)) => {
                ObserveOrigin::Stream(Uuid::new_v4().to_string(), Transport::TCP(config.into()))
            }
            ByteSourceConfig::Stream(StreamConfig::Udp(config)) => {
                ObserveOrigin::Stream(Uuid::new_v4().to_string(), Transport::UDP(config.into()))
            }
            ByteSourceConfig::Stream(StreamConfig::Serial(config)) => {
                ObserveOrigin::Stream(Uuid::new_v4().to_string(), Transport::Serial(config.into()))
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

    async fn send_host_err(&self, err: HostError) -> bool {
        self.communication
            .senders
            .send_notification(AppNotification::HostError(err))
            .await
    }

    fn is_dlt_file(file_path: &Path) -> bool {
        file_path
            .extension()
            .is_some_and(|ext| ext.eq_ignore_ascii_case("dlt"))
    }
}
