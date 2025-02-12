use std::fmt::{self, Display};

use crate::*;

impl PluginParserSettings {
    /// Creates a new instance of parser settings with the provided arguments.
    pub fn new(
        plugin_path: PathBuf,
        general_settings: PluginParserGeneralSettings,
        plugin_configs: Vec<PluginConfigItem>,
    ) -> Self {
        Self {
            plugin_path,
            general_settings,
            plugin_configs,
        }
    }
}

impl PluginByteSourceSettings {
    /// Creates a new instance of byte-source settings with the provided arguments.
    pub fn new(
        plugin_path: PathBuf,
        general_settings: PluginByteSourceGeneralSettings,
        plugin_configs: Vec<PluginConfigItem>,
    ) -> Self {
        Self {
            plugin_path,
            general_settings,
            plugin_configs,
        }
    }
}

impl PluginConfigSchemaItem {
    /// Creates a new instance of [`PluginConfigSchemaItem`] with the provided arguments.
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
    /// Creates a new instance of [`PluginConfigItem`] with the provided arguments.
    pub fn new(id: impl Into<String>, value: PluginConfigValue) -> Self {
        Self {
            id: id.into(),
            value,
        }
    }
}

impl SemanticVersion {
    /// Creates a new [`SemanticVersion`] with the provided arguments.
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

impl Display for PluginType {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            PluginType::Parser => f.write_str("Parser"),
            PluginType::ByteSource => f.write_str("Byte-Source"),
        }
    }
}
