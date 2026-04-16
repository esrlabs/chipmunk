pub mod dlt;
pub mod someip;
use std::path::PathBuf;

#[allow(unused)]
pub use dlt::{DltLogLevel, DltParserConfig};
use stypes::ObserveOptions;

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
    pub fn from_observe_options(options: &ObserveOptions) -> Self {
        match &options.parser {
            stypes::ParserType::Dlt(settings) => Self::Dlt(DltParserConfig::from_observe_options(
                settings,
                &options.origin,
            )),
            stypes::ParserType::SomeIp(settings) => {
                Self::SomeIP(SomeIpParserConfig::from_parser_settings(settings))
            }
            stypes::ParserType::Text(()) => Self::Text,
            // Plugins are not fully supported yet.
            stypes::ParserType::Plugin(..) => Self::Plugins,
        }
    }
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

impl FibexFileInfo {
    pub fn from_path_lossy(path: PathBuf) -> Self {
        let name = path
            .file_name()
            .map(|n| n.display().to_string())
            .unwrap_or_else(|| path.display().to_string());

        Self { name, path }
    }
}
