use std::path::PathBuf;
use tokio::sync::mpsc::Sender;
use uuid::Uuid;

use crate::host::{
    command::HostCommand,
    common::{
        parsers::{DltLogLevel, DltParserConfig, ParserConfig, ParserNames},
        sources::ByteSourceType,
    },
    ui::UiActions,
};

#[derive(Debug)]
pub struct SessionSetupState {
    pub id: Uuid,
    pub source: ByteSourceType,
    pub parser: ParserConfig,
    pub supported_parsers: Vec<ParserNames>,
    pub log_level: DltLogLevel,
    pub fibex_files: Vec<String>,
    pub timezone: String,
    pub timezone_filter: String,
}

impl SessionSetupState {
    pub fn new(
        id: Uuid,
        source: ByteSourceType,
        parser: ParserConfig,
        supported_parsers: Vec<ParserNames>,
    ) -> Self {
        Self {
            id,
            source,
            parser,
            supported_parsers,
            log_level: DltLogLevel::Verbose,
            fibex_files: Vec::new(),
            timezone: "UTC".into(),
            timezone_filter: String::new(),
        }
    }

    pub fn update_parser(&mut self, parser: ParserNames) {
        self.parser = match parser {
            ParserNames::Dlt => ParserConfig::Dlt(DltParserConfig {
                with_storage_header: match self.source {
                    ByteSourceType::File(..) => true,
                },
                log_level: self.log_level,
                fibex_file_paths: self.fibex_files.iter().map(PathBuf::from).collect(),
                timezone: if self.timezone.is_empty() {
                    None
                } else {
                    Some(self.timezone.clone())
                },
            }),
            ParserNames::SomeIP => ParserConfig::SomeIP,
            ParserNames::Text => ParserConfig::Text,
            ParserNames::Plugins => ParserConfig::Plugins,
        };
    }

    pub fn is_valid(&self) -> bool {
        self.source.is_valid() && self.parser.is_valid()
    }

    pub fn start_session(
        &self,
        cmd_tx: &Sender<crate::host::command::HostCommand>,
        actions: &mut UiActions,
    ) {
        debug_assert!(self.is_valid());

        let cmd = HostCommand::StartSession {
            session_setup_id: self.id,
            parser: self.parser.clone(),
            source: self.source.clone(),
        };
        actions.try_send_command(cmd_tx, cmd);
    }
}
