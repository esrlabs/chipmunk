pub mod dlt;

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
