use std::fmt::Display;

use stypes::ParserType;

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

    pub const fn is_compatible(self, stream: StreamNames) -> bool {
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
