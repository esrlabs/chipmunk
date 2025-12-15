use std::fmt::Display;

use stypes::ParserType;

use crate::host::ui::session_setup::state::parsers::ParserConfig;

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
}

impl Display for ParserNames {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let name = match self {
            ParserNames::Dlt => "Dlt",
            ParserNames::SomeIP => "SomeIP",
            ParserNames::Text => "Text",
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
