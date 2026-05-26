//! Shared mode selection for opening exported search results as a new session tab.

use stypes::{FileFormat, ObserveOrigin};

use crate::host::common::parsers::ParserNames;

/// Export/reopen strategy for search results opened as a generated tab.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SearchResultsTabMode {
    /// Export rendered text and reopen it as plain text while keeping the generic tab label.
    PreserveText,
    /// Export raw DLT bytes and reopen them with the original DLT parser configuration.
    PreserveDltBinary,
    /// Export rendered text and reopen it as a plain text tab.
    Text,
}

impl SearchResultsTabMode {
    /// Resolves the export/reopen strategy for the provided parser and observed sources.
    pub fn resolve_from<'a>(
        parser: ParserNames,
        origins: impl IntoIterator<Item = &'a ObserveOrigin>,
    ) -> Self {
        // Raw exports are only preserved when the exported bytes are a valid source for the
        // same parser.
        // * PCAP/PCAPNG exports are not valid PCAP containers for both DLT and SomeIP
        // * streams cannot be replayed from exported ranges.
        // * Plugin sources open as rendered text for now.

        let mut origins = origins.into_iter();
        let Some(first_origin) = origins.next() else {
            debug_assert!(
                false,
                "search-results tab mode requires at least one origin"
            );

            return SearchResultsTabMode::Text;
        };

        let Some(format) = first_file_format(first_origin) else {
            return SearchResultsTabMode::Text;
        };

        match (parser, format) {
            (ParserNames::Text, FileFormat::Text) => SearchResultsTabMode::PreserveText,
            (ParserNames::Dlt, FileFormat::Binary) => SearchResultsTabMode::PreserveDltBinary,
            _ => SearchResultsTabMode::Text,
        }
    }

    /// Returns the context-menu label for this mode.
    pub const fn context_menu_label(self) -> &'static str {
        match self {
            SearchResultsTabMode::PreserveText | SearchResultsTabMode::PreserveDltBinary => {
                "Open Search Results as New Tab"
            }
            SearchResultsTabMode::Text => "Open Search Results as New Text Tab",
        }
    }
}

/// Returns the file format that participates in mode selection.
fn first_file_format(origin: &ObserveOrigin) -> Option<FileFormat> {
    match origin {
        ObserveOrigin::File(_, format, _) => Some(*format),
        ObserveOrigin::Concat(items) => {
            let Some((_, format, _)) = items.first() else {
                debug_assert!(false, "concat origin requires at least one source");
                return None;
            };
            Some(*format)
        }
        ObserveOrigin::Stream(_, _) => None,
    }
}

#[cfg(test)]
mod tests {
    use std::path::PathBuf;

    use stypes::{FileFormat, ObserveOrigin, TCPTransportConfig, Transport, UDPTransportConfig};

    use super::*;

    fn file(format: FileFormat) -> ObserveOrigin {
        ObserveOrigin::File(String::from("source"), format, PathBuf::from("source.log"))
    }

    fn concat(format: FileFormat) -> ObserveOrigin {
        ObserveOrigin::Concat(vec![
            (String::from("first"), format, PathBuf::from("first.log")),
            (
                String::from("second"),
                FileFormat::PcapNG,
                PathBuf::from("second.pcapng"),
            ),
        ])
    }

    fn stream() -> ObserveOrigin {
        ObserveOrigin::Stream(
            String::from("stream"),
            Transport::TCP(TCPTransportConfig {
                bind_addr: String::from("127.0.0.1:5555"),
            }),
        )
    }

    #[test]
    fn text_file_preserves_text() {
        assert_eq!(
            SearchResultsTabMode::resolve_from(ParserNames::Text, &[file(FileFormat::Text)]),
            SearchResultsTabMode::PreserveText
        );
    }

    #[test]
    fn text_concat_preserves_text() {
        assert_eq!(
            SearchResultsTabMode::resolve_from(ParserNames::Text, &[concat(FileFormat::Text)]),
            SearchResultsTabMode::PreserveText
        );
    }

    #[test]
    fn text_stream_opens_text() {
        assert_eq!(
            SearchResultsTabMode::resolve_from(ParserNames::Text, &[stream()]),
            SearchResultsTabMode::Text
        );
    }

    #[test]
    fn dlt_binary_file_preserves_binary() {
        assert_eq!(
            SearchResultsTabMode::resolve_from(ParserNames::Dlt, &[file(FileFormat::Binary)]),
            SearchResultsTabMode::PreserveDltBinary
        );
    }

    #[test]
    fn dlt_binary_concat_preserves_binary() {
        assert_eq!(
            SearchResultsTabMode::resolve_from(ParserNames::Dlt, &[concat(FileFormat::Binary)]),
            SearchResultsTabMode::PreserveDltBinary
        );
    }

    #[test]
    fn dlt_pcap_opens_text() {
        for format in [FileFormat::PcapLegacy, FileFormat::PcapNG] {
            assert_eq!(
                SearchResultsTabMode::resolve_from(ParserNames::Dlt, &[file(format)]),
                SearchResultsTabMode::Text
            );
        }
    }

    #[test]
    fn dlt_stream_opens_text() {
        assert_eq!(
            SearchResultsTabMode::resolve_from(ParserNames::Dlt, &[stream()]),
            SearchResultsTabMode::Text
        );
    }

    #[test]
    fn someip_sources_open_text() {
        let origins = [
            file(FileFormat::Binary),
            file(FileFormat::PcapNG),
            ObserveOrigin::Stream(
                String::from("stream"),
                Transport::UDP(UDPTransportConfig {
                    bind_addr: String::from("127.0.0.1:5555"),
                    multicast: Vec::new(),
                }),
            ),
        ];

        for origin in origins {
            assert_eq!(
                SearchResultsTabMode::resolve_from(ParserNames::SomeIP, &[origin]),
                SearchResultsTabMode::Text
            );
        }
    }

    #[test]
    fn plugin_sources_open_text() {
        for origin in [file(FileFormat::Text), file(FileFormat::Binary), stream()] {
            assert_eq!(
                SearchResultsTabMode::resolve_from(ParserNames::Plugins, &[origin]),
                SearchResultsTabMode::Text
            );
        }
    }
}
