pub mod dlt;

use std::fmt::Display;

pub use dlt::{DltLogLevel, DltParserConfig};

/// Parser Configurations to be used in the front-end.
#[derive(Debug, Clone)]
pub enum ParserConfig {
    Dlt(DltParserConfig),
    SomeIP,
    Text,
    Plugins,
}

impl ParserConfig {
    /// Checks if the parser with the configurations is valid
    ///
    /// # Note:
    /// Function will be called in rendering loop and should be lightweight.
    pub fn is_valid(&self) -> bool {
        match self {
            ParserConfig::Dlt(..) => true,
            ParserConfig::SomeIP => false,
            ParserConfig::Text => false,
            ParserConfig::Plugins => false,
        }
    }
}

/// Slim variant of [`ParserConfig`] without their configurations.
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

impl From<&ParserConfig> for ParserNames {
    fn from(value: &ParserConfig) -> Self {
        match value {
            ParserConfig::Dlt(..) => ParserNames::Dlt,
            ParserConfig::SomeIP => ParserNames::SomeIP,
            ParserConfig::Text => ParserNames::Text,
            ParserConfig::Plugins => ParserNames::Plugins,
        }
    }
}
