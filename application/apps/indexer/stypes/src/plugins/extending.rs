use std::fmt::{self, Display};

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

impl SemanticVersion {
    /// Creates a new [`SemanticVersion`]
    pub fn new(major: u16, minor: u16, patch: u16) -> Self {
        Self {
            major,
            minor,
            patch,
        }
    }
}

impl Display for SemanticVersion {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}.{}.{}", self.major, self.minor, self.patch)
    }
}

impl InvalidPluginInfo {
    pub fn new(error_msg: String) -> Self {
        Self { error_msg }
    }
}
