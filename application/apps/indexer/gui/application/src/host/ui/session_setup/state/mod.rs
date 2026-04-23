use enum_iterator::all;
use tokio::sync::mpsc::Sender;
use uuid::Uuid;

use stypes::FileFormat;

use crate::host::{
    command::{DltStatisticsParam, HostCommand, StartSessionParam},
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
            ParserNames::Dlt => match &self.source {
                ByteSourceConfig::File(file) => ParserConfig::Dlt(Box::new(DltParserConfig::new(
                    Self::with_dlt_storage_header(file.format),
                    Some(vec![file.path.clone()]),
                ))),
                ByteSourceConfig::Concat(files) => {
                    let with_storage_header = files
                        .first()
                        .is_none_or(|file| Self::with_dlt_storage_header(file.format));
                    ParserConfig::Dlt(Box::new(DltParserConfig::new(
                        with_storage_header,
                        Some(files.iter().map(|f| f.path.clone()).collect()),
                    )))
                }
                ByteSourceConfig::Stream(..) => {
                    ParserConfig::Dlt(Box::new(DltParserConfig::new(false, None)))
                }
            },
            ParserNames::SomeIP => ParserConfig::SomeIP(SomeIpParserConfig::new()),
            ParserNames::Text => ParserConfig::Text,
            ParserNames::Plugins => ParserConfig::Plugins,
        };
    }

    fn with_dlt_storage_header(format: FileFormat) -> bool {
        // Only DLT files (still called Binary here) supports pcap header.
        // Network traces in PCAP files don't support it.
        matches!(format, FileFormat::Binary)
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
        if !parser.is_compatible_stream(stream) {
            let new_parser = all::<ParserNames>()
                .find(|p| p.is_compatible_stream(stream))
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

    pub fn collect_statistics(
        &mut self,
        cmd_tx: &Sender<crate::host::command::HostCommand>,
        actions: &mut UiActions,
    ) {
        debug_assert!(self.is_valid());

        if let ParserConfig::Dlt(config) = &mut self.parser
            && let Some(source_paths) = config.source_paths.take()
        {
            let param = DltStatisticsParam {
                session_setup_id: self.id,
                source_paths,
            };

            let cmd = HostCommand::DltStatistics(Box::new(param));

            actions.try_send_command(cmd_tx, cmd);
        }
    }

    pub fn start_session(
        &self,
        cmd_tx: &Sender<crate::host::command::HostCommand>,
        actions: &mut UiActions,
    ) {
        debug_assert!(self.is_valid());

        let param = StartSessionParam {
            parser: self.parser.clone(),
            source: self.source.clone(),
            session_setup_id: Some(self.id),
        };

        let cmd = HostCommand::StartSession(Box::new(param));

        actions.try_send_command(cmd_tx, cmd);
    }
}

#[cfg(test)]
mod tests {
    use std::path::PathBuf;

    use super::*;
    use crate::host::ui::session_setup::state::sources::SourceFileInfo;

    fn file(path: &str, format: FileFormat) -> SourceFileInfo {
        SourceFileInfo {
            path: PathBuf::from(path),
            name: String::from(path),
            size_byte: None,
            format,
        }
    }

    #[test]
    fn update_parser_disables_storage_header_for_pcap_files() {
        let mut state = SessionSetupState::new(
            Uuid::new_v4(),
            ByteSourceConfig::File(file("trace.pcapng", FileFormat::PcapNG)),
            ParserConfig::SomeIP(SomeIpParserConfig::new()),
        );

        state.update_parser(ParserNames::Dlt);

        let ParserConfig::Dlt(config) = &state.parser else {
            panic!("expected dlt parser config");
        };
        assert!(!config.with_storage_header);
    }

    #[test]
    fn update_parser_keeps_storage_header_for_binary_dlt_files() {
        let mut state = SessionSetupState::new(
            Uuid::new_v4(),
            ByteSourceConfig::File(file("trace.dlt", FileFormat::Binary)),
            ParserConfig::SomeIP(SomeIpParserConfig::new()),
        );

        state.update_parser(ParserNames::Dlt);

        let ParserConfig::Dlt(config) = &state.parser else {
            panic!("expected dlt parser config");
        };
        assert!(config.with_storage_header);
    }

    #[test]
    fn update_parser_disables_storage_header_for_pcap_concat() {
        let mut state = SessionSetupState::new(
            Uuid::new_v4(),
            ByteSourceConfig::Concat(vec![
                file("first.pcap", FileFormat::PcapLegacy),
                file("second.pcap", FileFormat::PcapLegacy),
            ]),
            ParserConfig::SomeIP(SomeIpParserConfig::new()),
        );

        state.update_parser(ParserNames::Dlt);

        let ParserConfig::Dlt(config) = &state.parser else {
            panic!("expected dlt parser config");
        };
        assert!(!config.with_storage_header);
    }
}
