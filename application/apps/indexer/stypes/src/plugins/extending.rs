use crate::*;

impl PluginParserSettings {
    /// Implementation needed during prototyping only
    pub fn prototyping(plugin_path: PathBuf, plugin_configs: Vec<PluginConfigItem>) -> Self {
        Self {
            plugin_path,
            general_settings: PluginParserGeneralSettings {
                placeholder: Default::default(),
            },
            plugin_configs,
        }
    }

    /// Default implementation needed during prototyping only
    pub fn default_prototyping() -> Self {
        Self::prototyping(PathBuf::default(), Vec::new())
    }
}

impl PluginByteSourceSettings {
    /// Implementation needed during prototyping only
    pub fn prototyping(plugin_path: PathBuf, plugin_configs: Vec<PluginConfigItem>) -> Self {
        Self {
            plugin_path,
            general_settings: PluginByteSourceGeneralSettings {
                placeholder: Default::default(),
            },
            plugin_configs,
        }
    }
}

impl PluginConfigSchemaItem {
    pub fn new<S: Into<String>>(
        id: S,
        title: S,
        description: Option<S>,
        input_type: PluginConfigSchemaType,
    ) -> Self {
        Self {
            id: id.into(),
            title: title.into(),
            description: description.map(|d| d.into()),
            input_type,
        }
    }
}

impl PluginConfigItem {
    pub fn new(id: impl Into<String>, value: PluginConfigValue) -> Self {
        Self {
            id: id.into(),
            value,
        }
    }
}
