use std::io;

use crate::PluginGuestInitError;

pub use self::chipmunk::plugin::{bytesource_types, shared_types};
use self::shared_types::{ConfigItem, ConfigSchemaItem, ConfigSchemaType, ConfigValue, Version};

wasmtime::component::bindgen!({
    path: "../plugins_api/wit/v_0.1.0/",
    world: "bytesource-plugin",
    async: {
        only_imports: [],
    },
});

impl From<&stypes::PluginByteSourceGeneralSettings> for bytesource_types::SourceConfig {
    fn from(_value: &stypes::PluginByteSourceGeneralSettings) -> Self {
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

use stypes::PluginConfigValue as HostConfValue;
impl From<HostConfValue> for ConfigValue {
    fn from(value: HostConfValue) -> Self {
        match value {
            HostConfValue::Boolean(val) => ConfigValue::Boolean(val),
            HostConfValue::Number(val) => ConfigValue::Number(val),
            HostConfValue::Float(val) => ConfigValue::Float(val),
            HostConfValue::Text(val) => ConfigValue::Text(val),
            HostConfValue::Path(val) => ConfigValue::Path(val.to_string_lossy().to_string()),
            HostConfValue::Dropdown(val) => ConfigValue::Dropdown(val),
        }
    }
}

impl From<stypes::PluginConfigItem> for ConfigItem {
    fn from(item: stypes::PluginConfigItem) -> Self {
        Self {
            id: item.id,
            value: item.value.into(),
        }
    }
}

use stypes::PluginConfigSchemaType as HostSchemaType;
use stypes::SemanticVersion;
impl From<ConfigSchemaType> for HostSchemaType {
    fn from(value: ConfigSchemaType) -> Self {
        match value {
            ConfigSchemaType::Boolean => HostSchemaType::Boolean,
            ConfigSchemaType::Number => HostSchemaType::Number,
            ConfigSchemaType::Float => HostSchemaType::Float,
            ConfigSchemaType::Text => HostSchemaType::Text,
            ConfigSchemaType::Path => HostSchemaType::Path,
            ConfigSchemaType::Dropdown(items) => HostSchemaType::Dropdown(items),
        }
    }
}

impl From<ConfigSchemaItem> for stypes::PluginConfigSchemaItem {
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
