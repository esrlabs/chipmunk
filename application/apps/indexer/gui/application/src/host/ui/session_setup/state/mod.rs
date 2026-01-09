use tokio::sync::mpsc::Sender;
use uuid::Uuid;

use crate::host::{
    command::{HostCommand, StartSessionParam},
    common::{parsers::ParserNames, sources::StreamNames},
    ui::{
        UiActions,
        session_setup::state::{
            parsers::someip::SomeIpParserConfig,
            sources::{ProcessConfig, SerialConfig, StreamConfig, TcpConfig, UdpConfig},
        },
    },
};
use parsers::{DltParserConfig, ParserConfig};
use sources::ByteSourceConfig;

pub mod parsers;
pub mod sources;

#[derive(Debug)]
pub struct SessionSetupState {
    pub id: Uuid,
    pub source: ByteSourceConfig,
    pub parser: ParserConfig,
}

impl SessionSetupState {
    pub fn new(id: Uuid, source: ByteSourceConfig, parser: ParserConfig) -> Self {
        Self { id, source, parser }
    }

    pub fn update_parser(&mut self, parser: ParserNames) {
        self.parser = match parser {
            ParserNames::Dlt => {
                let with_headers = match self.source {
                    ByteSourceConfig::File(..) => true,
                    ByteSourceConfig::Stream(..) => false,
                };
                ParserConfig::Dlt(DltParserConfig::new(with_headers))
            }
            ParserNames::SomeIP => ParserConfig::SomeIP(SomeIpParserConfig::new()),
            ParserNames::Text => ParserConfig::Text,
            ParserNames::Plugins => ParserConfig::Plugins,
        };
    }

    pub fn update_stream(&mut self, stream: StreamNames) {
        self.source = match stream {
            StreamNames::Process => {
                ByteSourceConfig::Stream(StreamConfig::Process(ProcessConfig::new()))
            }
            StreamNames::Tcp => ByteSourceConfig::Stream(StreamConfig::Tcp(TcpConfig::new())),
            StreamNames::Udp => ByteSourceConfig::Stream(StreamConfig::Udp(UdpConfig::new())),
            StreamNames::Serial => {
                ByteSourceConfig::Stream(StreamConfig::Serial(SerialConfig::new()))
            }
        };

        // Check if current parser is compatible with the new source
        let parser = ParserNames::from(&self.parser);
        if !parser.is_compatible(stream) {
            let new_parser = ParserNames::all()
                .iter()
                .find(|p| p.is_compatible(stream))
                .copied()
                .unwrap_or(ParserNames::Text);
            self.update_parser(new_parser);
        }
    }

    pub fn validatio_errors(&self) -> Vec<&str> {
        let mut errs = self.source.validation_errors();
        errs.extend(self.parser.validation_errors());

        errs
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

        let session_params = StartSessionParam {
            session_setup_id: self.id,
            parser: self.parser.clone(),
            source: self.source.clone(),
        };

        let cmd = HostCommand::StartSession(Box::new(session_params));

        actions.try_send_command(cmd_tx, cmd);
    }
}
