use tokio::sync::mpsc::Sender;
use uuid::Uuid;

use crate::host::{
    command::HostCommand,
    common::{parsers::ParserNames, sources::ByteSourceType},
    ui::UiActions,
};
use parsers::{DltParserConfig, ParserConfig};

pub mod parsers;

#[derive(Debug)]
pub struct SessionSetupState {
    pub id: Uuid,
    pub source: ByteSourceType,
    pub parser: ParserConfig,
    pub supported_parsers: Vec<ParserNames>,
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
        }
    }

    pub fn update_parser(&mut self, parser: ParserNames) {
        self.parser = match parser {
            ParserNames::Dlt => {
                let with_headers = match self.source {
                    ByteSourceType::File(..) => true,
                };
                ParserConfig::Dlt(DltParserConfig::new(with_headers))
            }
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
