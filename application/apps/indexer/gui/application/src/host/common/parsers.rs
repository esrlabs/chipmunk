use std::fmt::Display;

use stypes::{FileFormat, ParserType};

use crate::host::{common::sources::StreamNames, ui::session_setup::state::parsers::ParserConfig};

/// Slim variant of [`ParserType`] without their configurations.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ParserNames {
    Dlt,
    SomeIP,
    Text,
    Plugins,
}

impl ParserNames {
    pub const fn all() -> &'static [ParserNames] {
        // Reminder to add on new types
        match ParserNames::Dlt {
            ParserNames::Dlt => {}
            ParserNames::SomeIP => {}
            ParserNames::Text => {}
            ParserNames::Plugins => {}
        }

        &[
            ParserNames::Dlt,
            ParserNames::SomeIP,
            ParserNames::Text,
            ParserNames::Plugins,
        ]
    }

    pub const fn support_binary_files(self) -> bool {
        match self {
            ParserNames::Dlt | ParserNames::SomeIP | ParserNames::Plugins => true,
            ParserNames::Text => false,
        }
    }

    pub const fn support_text_files(self) -> bool {
        match self {
            ParserNames::Text | ParserNames::Plugins => true,
            ParserNames::Dlt | ParserNames::SomeIP => false,
        }
    }

    pub const fn is_compatible_file(self, format: FileFormat) -> bool {
        match format {
            FileFormat::PcapNG | FileFormat::PcapLegacy | FileFormat::Binary => {
                self.support_binary_files()
            }
            FileFormat::Text => self.support_text_files(),
        }
    }

    pub const fn is_compatible_stream(self, stream: StreamNames) -> bool {
        use ParserNames as Parser;
        use StreamNames as Stream;

        match (self, stream) {
            (Parser::Text, Stream::Process | Stream::Serial) => true,
            (Parser::Text, Stream::Tcp | Stream::Udp) => false,
            (Parser::Dlt | Parser::SomeIP, Stream::Tcp | Stream::Udp | Stream::Serial) => true,
            (Parser::Dlt | Parser::SomeIP, Stream::Process) => false,
            (Parser::Plugins, _) => true,
        }
    }
}

impl Display for ParserNames {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let name = match self {
            ParserNames::Dlt => "Dlt",
            ParserNames::SomeIP => "SomeIP",
            ParserNames::Text => "Plain Text",
            ParserNames::Plugins => "Plugins",
        };

        f.write_str(name)
    }
}

impl From<&ParserType> for ParserNames {
    fn from(value: &ParserType) -> Self {
        match value {
            ParserType::Dlt(..) => ParserNames::Dlt,
            ParserType::SomeIp(..) => ParserNames::SomeIP,
            ParserType::Text(..) => ParserNames::Text,
            ParserType::Plugin(..) => ParserNames::Plugins,
        }
    }
}

impl From<&ParserConfig> for ParserNames {
    fn from(value: &ParserConfig) -> Self {
        match value {
            ParserConfig::Dlt(..) => ParserNames::Dlt,
            ParserConfig::SomeIP(..) => ParserNames::SomeIP,
            ParserConfig::Text => ParserNames::Text,
            ParserConfig::Plugins => ParserNames::Plugins,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use stypes::FileFormat;

    #[test]
    fn test_file_compatibility() {
        let binary_formats = [
            FileFormat::PcapNG,
            FileFormat::PcapLegacy,
            FileFormat::Binary,
        ];
        let text_formats = [FileFormat::Text];

        let binary_parsers = [ParserNames::Dlt, ParserNames::SomeIP, ParserNames::Plugins];
        let text_parsers = [ParserNames::Text, ParserNames::Plugins];

        // Test Binary Formats
        for format in binary_formats {
            for parser in binary_parsers {
                assert!(
                    parser.is_compatible_file(format),
                    "Parser {parser} should be compatible with {format:?}"
                );
            }
            // Text parser should NOT be compatible with binary
            assert!(!ParserNames::Text.is_compatible_file(format));
        }

        // Test Text Formats
        for format in text_formats {
            for parser in text_parsers {
                assert!(
                    parser.is_compatible_file(format),
                    "Parser {parser} should be compatible with {format:?}"
                );
            }
            // Binary parsers (except Plugins) should NOT be compatible with text
            assert!(!ParserNames::Dlt.is_compatible_file(format));
            assert!(!ParserNames::SomeIP.is_compatible_file(format));
        }
    }

    #[test]
    fn test_stream_compatibility() {
        // Text: Compatible with Process, Serial. NOT Tcp, Udp
        assert!(ParserNames::Text.is_compatible_stream(StreamNames::Process));
        assert!(ParserNames::Text.is_compatible_stream(StreamNames::Serial));
        assert!(!ParserNames::Text.is_compatible_stream(StreamNames::Tcp));
        assert!(!ParserNames::Text.is_compatible_stream(StreamNames::Udp));

        // Dlt/SomeIP: Compatible with Tcp, Udp, Serial. NOT Process
        for parser in [ParserNames::Dlt, ParserNames::SomeIP] {
            assert!(parser.is_compatible_stream(StreamNames::Tcp));
            assert!(parser.is_compatible_stream(StreamNames::Udp));
            assert!(parser.is_compatible_stream(StreamNames::Serial));
            assert!(!parser.is_compatible_stream(StreamNames::Process));
        }

        // Plugins: Compatible with everything
        for stream in [
            StreamNames::Process,
            StreamNames::Serial,
            StreamNames::Tcp,
            StreamNames::Udp,
        ] {
            assert!(ParserNames::Plugins.is_compatible_stream(stream));
        }
    }
}
