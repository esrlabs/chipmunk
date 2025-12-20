pub mod dlt;
pub mod someip;

use std::path::PathBuf;

#[allow(unused)]
pub use dlt::{DltLogLevel, DltParserConfig};

use crate::host::ui::session_setup::state::parsers::someip::SomeIpParserConfig;

/// Parser Configurations to be used in the front-end.
#[derive(Debug, Clone)]
pub enum ParserConfig {
    Dlt(DltParserConfig),
    SomeIP(SomeIpParserConfig),
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
            ParserConfig::SomeIP(..) => true,
            ParserConfig::Text => true,
            ParserConfig::Plugins => false,
        }
    }

    pub fn validation_errors(&self) -> Vec<&str> {
        Vec::new()
    }
}

#[derive(Debug, Clone)]
pub struct FibexFileInfo {
    pub name: String,
    pub path: PathBuf,
}
