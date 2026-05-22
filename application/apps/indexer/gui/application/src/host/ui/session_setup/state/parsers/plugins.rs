//! Parser plugin setup state and defaults.
//!
//! This module keeps parser plugin setup state in the same shape used by the
//! runtime and recent-session persistence.

use std::path::Path;

use stypes::{
    PluginConfigItem, PluginConfigSchemaItem, PluginConfigSchemaType, PluginConfigValue,
    PluginEntity, PluginParserGeneralSettings, PluginParserSettings, PluginType,
};

use crate::host::ui::state::plugin::PluginsData;

const NO_PLUGIN_SELECTED: &str = "No parser plugin selected.";
const INVALID_PLUGIN_KIND: &str = "Selected plugin is not a parser plugin.";

/// Session setup state for the plugin parser.
#[derive(Debug, Clone)]
pub struct PluginParserConfig {
    settings: Option<PluginParserSettings>,
    validation_errors: Vec<&'static str>,
}

impl PluginParserConfig {
    /// Creates an empty plugin parser config.
    pub fn new() -> Self {
        Self {
            settings: None,
            validation_errors: vec![NO_PLUGIN_SELECTED],
        }
    }

    /// Restores plugin parser config from runtime/persisted settings.
    pub fn from_settings(settings: PluginParserSettings) -> Self {
        Self {
            settings: Some(settings),
            validation_errors: Vec::new(),
        }
    }

    /// Returns the selected parser plugin settings, if one has been selected.
    pub fn selected_settings(&self) -> Option<&PluginParserSettings> {
        self.settings.as_ref()
    }

    /// Returns the selected plugin WASM path, if one has been selected.
    pub fn selected_plugin_path(&self) -> Option<&Path> {
        self.selected_settings()
            .map(|settings| settings.plugin_path.as_path())
    }

    /// Returns the selected plugin directory derived from the stored WASM path.
    pub fn selected_plugin_dir(&self) -> Option<&Path> {
        self.selected_plugin_path()
            .and_then(Path::parent)
            .filter(|path| !path.as_os_str().is_empty())
    }

    /// Resolves stored settings to the current plugin entity, when available.
    pub fn resolved_plugin<'a>(&self, data: &'a PluginsData) -> Option<&'a PluginEntity> {
        let dir_path = self.selected_plugin_dir()?;
        data.installed
            .iter()
            .find(|plugin| plugin.plugin_type == PluginType::Parser && plugin.dir_path == dir_path)
    }

    /// Selects a parser plugin and rebuilds plugin config values from schema defaults.
    pub fn select_plugin(&mut self, plugin: &PluginEntity) {
        if plugin.plugin_type != PluginType::Parser {
            self.settings = None;
            self.validation_errors = vec![INVALID_PLUGIN_KIND];
            return;
        }

        self.settings = Some(PluginParserSettings {
            plugin_path: plugin.info.wasm_file_path.clone(),
            general_settings: PluginParserGeneralSettings::default(),
            plugin_configs: default_config_items(&plugin.info.config_schemas),
        });
        self.validation_errors.clear();
    }

    /// Returns the mutable config value for a schema item.
    pub fn config_value_mut(
        &mut self,
        schema: &PluginConfigSchemaItem,
    ) -> Option<&mut PluginConfigValue> {
        self.settings
            .as_mut()?
            .plugin_configs
            .iter_mut()
            .find(|item| item.id == schema.id)
            .map(|item| &mut item.value)
    }

    /// Clears the selected plugin and cached plugin config values.
    pub fn clear_selection(&mut self) {
        self.settings = None;
        self.validation_errors = vec![NO_PLUGIN_SELECTED];
    }

    /// Returns whether the cached validation state allows starting a plugin parser session.
    pub fn is_valid(&self) -> bool {
        self.validation_errors.is_empty()
    }

    /// Returns cached validation errors suitable for UI display.
    pub fn validation_errors(&self) -> &[&'static str] {
        &self.validation_errors
    }

    /// Builds backend parser settings when the cached validation state is valid.
    pub fn parser_settings(&self) -> Result<PluginParserSettings, &'static str> {
        if !self.is_valid() {
            return Err("Plugin parser configuration is invalid.");
        }

        self.settings.clone().ok_or(NO_PLUGIN_SELECTED)
    }
}

fn default_config_items(schemas: &[PluginConfigSchemaItem]) -> Vec<PluginConfigItem> {
    schemas
        .iter()
        .map(|schema| PluginConfigItem {
            id: schema.id.clone(),
            value: default_config_value(&schema.input_type),
        })
        .collect()
}

fn default_config_value(input_type: &PluginConfigSchemaType) -> PluginConfigValue {
    match input_type {
        PluginConfigSchemaType::Boolean(value) => PluginConfigValue::Boolean(*value),
        PluginConfigSchemaType::Integer(value) => PluginConfigValue::Integer(*value),
        PluginConfigSchemaType::Float(value) => PluginConfigValue::Float(*value),
        PluginConfigSchemaType::Text(value) => PluginConfigValue::Text(value.clone()),
        PluginConfigSchemaType::Directories => PluginConfigValue::Directories(Vec::new()),
        PluginConfigSchemaType::Files(_) => PluginConfigValue::Files(Vec::new()),
        PluginConfigSchemaType::Dropdown((options, value)) => {
            // Fallback to the first item if the default value isn't included in the options.
            let default_option = options
                .iter()
                .find(|option| option.as_str() == value)
                .or_else(|| options.first())
                .unwrap_or(value)
                .to_owned();

            PluginConfigValue::Dropdown(default_option)
        }
    }
}

#[cfg(test)]
mod tests {
    use std::path::PathBuf;

    use stypes::{ParserRenderOptions, PluginInfo, PluginMetadata, RenderOptions, SemanticVersion};

    use super::*;

    fn parser_plugin(dir_path: &str, wasm_path: &str) -> PluginEntity {
        plugin(dir_path, wasm_path, PluginType::Parser, Vec::new())
    }

    fn plugin(
        dir_path: &str,
        wasm_path: &str,
        plugin_type: PluginType,
        config_schemas: Vec<PluginConfigSchemaItem>,
    ) -> PluginEntity {
        PluginEntity {
            dir_path: PathBuf::from(dir_path),
            plugin_type,
            info: PluginInfo {
                wasm_file_path: PathBuf::from(wasm_path),
                api_version: SemanticVersion::V0_1_0,
                plugin_version: SemanticVersion::V0_1_0,
                config_schemas,
                render_options: RenderOptions::Parser(Box::new(ParserRenderOptions {
                    columns_options: None,
                })),
            },
            metadata: PluginMetadata {
                title: "Test plugin".to_owned(),
                description: None,
            },
            readme_path: None,
        }
    }

    fn schema(id: &str, input_type: PluginConfigSchemaType) -> PluginConfigSchemaItem {
        PluginConfigSchemaItem {
            id: id.to_owned(),
            title: id.to_owned(),
            description: None,
            input_type,
        }
    }

    #[test]
    fn empty_config_is_invalid() {
        let config = PluginParserConfig::new();

        assert!(!config.is_valid());
        assert!(!config.validation_errors().is_empty());
    }

    #[test]
    fn selecting_parser_plugin_creates_schema_defaults() {
        let plugin = plugin(
            "/plugins/parser",
            "/plugins/parser/parser.wasm",
            PluginType::Parser,
            vec![
                schema("boolean", PluginConfigSchemaType::Boolean(true)),
                schema("integer", PluginConfigSchemaType::Integer(7)),
                schema("float", PluginConfigSchemaType::Float(1.5)),
                schema("text", PluginConfigSchemaType::Text("default".to_owned())),
                schema("directories", PluginConfigSchemaType::Directories),
                schema(
                    "files",
                    PluginConfigSchemaType::Files(vec!["log".to_owned()]),
                ),
                schema(
                    "dropdown",
                    PluginConfigSchemaType::Dropdown((
                        vec!["first".to_owned()],
                        "missing-default".to_owned(),
                    )),
                ),
            ],
        );
        let mut config = PluginParserConfig::new();

        config.select_plugin(&plugin);

        let configs = &config.selected_settings().unwrap().plugin_configs;
        assert!(matches!(
            &configs[0].value,
            PluginConfigValue::Boolean(true)
        ));
        assert!(matches!(&configs[1].value, PluginConfigValue::Integer(7)));
        assert!(matches!(
            &configs[2].value,
            PluginConfigValue::Float(value) if (*value - 1.5).abs() < f32::EPSILON
        ));
        assert!(matches!(
            &configs[3].value,
            PluginConfigValue::Text(value) if value == "default"
        ));
        assert!(matches!(
            &configs[4].value,
            PluginConfigValue::Directories(paths) if paths.is_empty()
        ));
        assert!(matches!(
            &configs[5].value,
            PluginConfigValue::Files(paths) if paths.is_empty()
        ));
        assert!(matches!(
            &configs[6].value,
            PluginConfigValue::Dropdown(value) if value == "first"
        ));
    }

    #[test]
    fn selected_parser_plugin_validates_with_default_configs() {
        let plugin = parser_plugin("/plugins/parser", "/plugins/parser/parser.wasm");
        let mut config = PluginParserConfig::new();

        config.select_plugin(&plugin);

        assert!(config.is_valid());
    }

    #[test]
    fn byte_source_plugin_cannot_validate_as_parser_plugin() {
        let plugin = plugin(
            "/plugins/source",
            "/plugins/source/source.wasm",
            PluginType::ByteSource,
            Vec::new(),
        );
        let mut config = PluginParserConfig::new();

        config.select_plugin(&plugin);

        assert!(!config.is_valid());
        assert!(config.selected_settings().is_none());
    }

    #[test]
    fn parser_settings_use_wasm_file_path() {
        let plugin = parser_plugin("/plugins/parser-dir", "/plugins/parser-dir/runtime.wasm");
        let mut config = PluginParserConfig::new();
        config.select_plugin(&plugin);

        let settings = config.parser_settings().unwrap();

        assert_eq!(
            settings.plugin_path,
            PathBuf::from("/plugins/parser-dir/runtime.wasm")
        );
    }
}
