use std::io;

use sources::plugins as pl;

use crate::{semantic_version::SemanticVersion, PluginGuestInitError};

pub use self::chipmunk::plugin::{bytesource_types, shared_types};
use self::shared_types::{ConfigItem, ConfigSchemaItem, ConfigSchemaType, ConfigValue, Version};

wasmtime::component::bindgen!({
    path: "../plugins_api/wit/v_0.1.0/",
    world: "bytesource-plugin",
    async: {
        only_imports: [],
    },
});

impl From<&pl::PluginByteSourceGeneralSettings> for bytesource_types::SourceConfig {
    fn from(_value: &pl::PluginByteSourceGeneralSettings) -> Self {
        // We must use the current log level form chipmunk because we are using the same log
        // functionality to log the message from the plugins.
        let current_log_level = log::max_level().to_level().unwrap_or(log::Level::Error);

        use chipmunk::plugin::logging::Level as PlugLevel;
        let level = match current_log_level {
            log::Level::Error => PlugLevel::Error,
            log::Level::Warn => PlugLevel::Warn,
            log::Level::Info => PlugLevel::Info,
            log::Level::Debug => PlugLevel::Debug,
            log::Level::Trace => PlugLevel::Trace,
        };

        Self { log_level: level }
    }
}

impl From<shared_types::InitError> for PluginGuestInitError {
    fn from(value: shared_types::InitError) -> Self {
        use shared_types::InitError as E;
        use PluginGuestInitError as GuestE;
        match value {
            E::Config(msg) => GuestE::Config(msg),
            E::Io(msg) => GuestE::IO(msg),
            E::Unsupported(msg) => GuestE::Unsupported(msg),
            E::Other(msg) => GuestE::Other(msg),
        }
    }
}

impl From<bytesource_types::SourceError> for io::Error {
    fn from(value: bytesource_types::SourceError) -> Self {
        use bytesource_types::SourceError as E;
        let msg = match value {
            E::Io(msg) => format!("IO Error from bytesoruce plugin. Error: {msg}"),
            E::Unsupported => String::from("Unsupported Error from bytesource plugin"),
            E::Other(msg) => format!("Unknown Error from bytesoruce plugin. Error: {msg}"),
        };

        io::Error::new(io::ErrorKind::Other, msg)
    }
}

impl From<pl::ConfigValue> for ConfigValue {
    fn from(value: pl::ConfigValue) -> Self {
        match value {
            pl::ConfigValue::Boolean(val) => ConfigValue::Boolean(val),
            pl::ConfigValue::Number(val) => ConfigValue::Number(val),
            pl::ConfigValue::Float(val) => ConfigValue::Float(val),
            pl::ConfigValue::Text(val) => ConfigValue::Text(val),
            pl::ConfigValue::Path(val) => ConfigValue::Path(val.to_string_lossy().to_string()),
            pl::ConfigValue::Dropdown(val) => ConfigValue::Dropdown(val),
        }
    }
}

impl From<pl::ConfigItem> for ConfigItem {
    fn from(item: pl::ConfigItem) -> Self {
        Self {
            id: item.id,
            value: item.value.into(),
        }
    }
}

impl From<ConfigSchemaType> for pl::ConfigSchemaType {
    fn from(value: ConfigSchemaType) -> Self {
        match value {
            ConfigSchemaType::Boolean => pl::ConfigSchemaType::Boolean,
            ConfigSchemaType::Number => pl::ConfigSchemaType::Number,
            ConfigSchemaType::Float => pl::ConfigSchemaType::Float,
            ConfigSchemaType::Text => pl::ConfigSchemaType::Text,
            ConfigSchemaType::Path => pl::ConfigSchemaType::Path,
            ConfigSchemaType::Dropdown(items) => pl::ConfigSchemaType::Dropdown(items),
        }
    }
}

impl From<ConfigSchemaItem> for pl::ConfigSchemaItem {
    fn from(item: ConfigSchemaItem) -> Self {
        Self {
            id: item.id,
            title: item.title,
            description: item.description,
            input_type: item.input_type.into(),
        }
    }
}

impl From<Version> for SemanticVersion {
    fn from(value: Version) -> Self {
        Self::new(value.major, value.minor, value.patch)
    }
}
