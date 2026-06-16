//! Parser-specific setup state used before starting a session.

pub mod dlt;
pub mod plugins;
pub mod someip;
use std::path::PathBuf;

pub use dlt::DltParserConfig;
pub use plugins::PluginParserConfig;
use stypes::ObserveOptions;

pub use crate::host::ui::session_setup::state::parsers::someip::SomeIpParserConfig;

/// Parser Configurations to be used in the front-end.
#[derive(Debug, Clone)]
pub enum ParserConfig {
    Dlt(Box<DltParserConfig>),
    SomeIP(Box<SomeIpParserConfig>),
    Text,
    /// Parser plugin setup state.
    Plugins(Box<PluginParserConfig>),
}

impl ParserConfig {
    pub fn from_observe_options(options: &ObserveOptions) -> Self {
        match &options.parser {
            stypes::ParserType::Dlt(settings) => Self::Dlt(Box::new(
                DltParserConfig::from_observe_options(settings, &options.origin),
            )),
            stypes::ParserType::SomeIp(settings) => Self::SomeIP(Box::new(
                SomeIpParserConfig::from_observe_options(settings, &options.origin),
            )),
            stypes::ParserType::Text(()) => Self::Text,
            stypes::ParserType::Plugin(settings) => {
                let config = PluginParserConfig::from_settings(settings.clone());
                Self::Plugins(Box::new(config))
            }
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
            ParserConfig::Plugins(config) => config.is_valid(),
        }
    }

    /// Returns cached parser validation errors suitable for UI display.
    pub fn validation_errors(&self) -> Vec<&str> {
        match self {
            ParserConfig::Dlt(..) | ParserConfig::SomeIP(..) | ParserConfig::Text => Vec::new(),
            ParserConfig::Plugins(config) => config.validation_errors().to_vec(),
        }
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

#[cfg(test)]
mod tests {
    use stypes::{
        FileFormat, ObserveOptions, ParserType, PluginConfigItem, PluginConfigValue,
        PluginParserGeneralSettings, PluginParserSettings,
    };

    use super::*;

    #[test]
    fn from_observe_options_preserves_plugin_settings() {
        let settings = PluginParserSettings {
            plugin_path: PathBuf::from("/plugins/parser/parser.wasm"),
            general_settings: PluginParserGeneralSettings {
                placeholder: "kept".to_owned(),
            },
            plugin_configs: vec![PluginConfigItem {
                id: "config".to_owned(),
                value: PluginConfigValue::Text("value".to_owned()),
            }],
        };
        let options = ObserveOptions::file(
            PathBuf::from("input.log"),
            FileFormat::Text,
            ParserType::Plugin(settings.clone()),
        );

        let ParserConfig::Plugins(config) = ParserConfig::from_observe_options(&options) else {
            panic!("expected plugin parser config");
        };
        let restored = config.selected_settings().unwrap();

        assert_eq!(restored.plugin_path, settings.plugin_path);
        assert_eq!(restored.general_settings.placeholder, "kept");
        assert_eq!(restored.plugin_configs.len(), 1);
        assert_eq!(restored.plugin_configs[0].id, "config");
    }
}
