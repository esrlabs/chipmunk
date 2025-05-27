use std::fmt::{self, Display};

use crate::*;

/// Represents an extended plugin entity used only on the backend
/// to store all relevant data about a plugin. This structure is not
/// transmitted to the front-end in this form.
#[derive(Debug)]
pub struct ExtendedPluginEntity {
    /// The core entity representing the plugin.
    pub entity: PluginEntity,
    /// Runtime data associated with the plugin.
    pub run_data: PluginRunData,
}

impl ExtendedPluginEntity {
    pub fn new(entity: PluginEntity, run_data: PluginRunData) -> Self {
        Self { entity, run_data }
    }
}

impl<'a> From<&'a ExtendedPluginEntity> for &'a PluginEntity {
    fn from(value: &'a ExtendedPluginEntity) -> Self {
        &value.entity
    }
}

impl From<PluginEntity> for ExtendedPluginEntity {
    fn from(entity: PluginEntity) -> Self {
        Self {
            entity,
            run_data: PluginRunData::default(),
        }
    }
}

/// Represents an extended invalid plugin entity used exclusively on the backend
/// to maintain the integrity of all plugin-related data. This structure is not
/// transmitted to the front-end in this form.
#[derive(Debug)]
pub struct ExtendedInvalidPluginEntity {
    /// The core entity representing an invalid plugin.
    pub entity: InvalidPluginEntity,
    /// Runtime data associated with the invalid plugin.
    pub run_data: PluginRunData,
}

impl ExtendedInvalidPluginEntity {
    pub fn new(entity: InvalidPluginEntity, run_data: PluginRunData) -> Self {
        Self { entity, run_data }
    }
}

impl<'a> From<&'a ExtendedInvalidPluginEntity> for &'a InvalidPluginEntity {
    fn from(value: &'a ExtendedInvalidPluginEntity) -> Self {
        &value.entity
    }
}

impl From<InvalidPluginEntity> for ExtendedInvalidPluginEntity {
    fn from(entity: InvalidPluginEntity) -> Self {
        Self {
            entity,
            run_data: PluginRunData::default(),
        }
    }
}

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
    /// Version `0.1.0`
    pub const V0_1_0: SemanticVersion = SemanticVersion::new(0, 1, 0);

    /// Creates a new [`SemanticVersion`] with the provided arguments.
    pub const fn new(major: u16, minor: u16, patch: u16) -> Self {
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

impl PluginRunData {
    /// Adds a debug-level log message.
    ///
    /// # Arguments
    /// * `msg` - The message to log. Accepts any type that implements `Into<String>`.
    pub fn debug<S: Into<String>>(&mut self, msg: S) {
        self.logs.push(PluginLogMessage::debug(msg));
    }

    /// Adds an info-level log message.
    ///
    /// # Arguments
    /// * `msg` - The message to log. Accepts any type that implements `Into<String>`.
    pub fn info<S: Into<String>>(&mut self, msg: S) {
        self.logs.push(PluginLogMessage::info(msg));
    }

    /// Adds an error-level log message.
    ///
    /// # Arguments
    /// * `msg` - The message to log. Accepts any type that implements `Into<String>`.
    pub fn err<S: Into<String>>(&mut self, msg: S) {
        self.logs.push(PluginLogMessage::err(msg));
    }

    /// Adds a warning-level log message.
    ///
    /// # Arguments
    /// * `msg` - The message to log. Accepts any type that implements `Into<String>`.
    pub fn warn<S: Into<String>>(&mut self, msg: S) {
        self.logs.push(PluginLogMessage::warn(msg));
    }
}

impl PluginLogMessage {
    /// Returns the current timestamp in seconds since the Unix epoch.
    fn timestamp() -> u64 {
        use std::time::{SystemTime, UNIX_EPOCH};
        let start = SystemTime::now();
        match start.duration_since(UNIX_EPOCH) {
            Ok(since) => since.as_secs(),
            Err(_) => 0,
        }
    }

    /// Creates a debug-level log message.
    ///
    /// # Arguments
    /// * `msg` - The message to log. Accepts any type that implements `Into<String>`.
    pub fn debug<S: Into<String>>(msg: S) -> Self {
        Self {
            msg: msg.into(),
            level: PluginLogLevel::Debug,
            timestamp: Self::timestamp(),
        }
    }

    /// Creates an info-level log message.
    ///
    /// # Arguments
    /// * `msg` - The message to log. Accepts any type that implements `Into<String>`.
    pub fn info<S: Into<String>>(msg: S) -> Self {
        Self {
            msg: msg.into(),
            level: PluginLogLevel::Info,
            timestamp: Self::timestamp(),
        }
    }

    /// Creates an error-level log message.
    ///
    /// # Arguments
    /// * `msg` - The message to log. Accepts any type that implements `Into<String>`.
    pub fn err<S: Into<String>>(msg: S) -> Self {
        Self {
            msg: msg.into(),
            level: PluginLogLevel::Err,
            timestamp: Self::timestamp(),
        }
    }

    /// Creates a warning-level log message.
    ///
    /// # Arguments
    /// * `msg` - The message to log. Accepts any type that implements `Into<String>`.
    pub fn warn<S: Into<String>>(msg: S) -> Self {
        Self {
            msg: msg.into(),
            level: PluginLogLevel::Warn,
            timestamp: Self::timestamp(),
        }
    }
}
