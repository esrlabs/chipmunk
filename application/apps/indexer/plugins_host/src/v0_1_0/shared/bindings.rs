use self::chipmunk::shared::shared_types::{
    ColumnInfo, ConfigItem, ConfigSchemaItem, ConfigSchemaType, ConfigValue, InitError, Version,
};
use crate::PluginGuestError;
use stypes::{
    PluginConfigSchemaType as HostSchemaType, PluginConfigValue as HostConfValue,
    SemanticVersion as HostVersion,
};
wasmtime::component::bindgen!({
    path: "../../../../plugins/plugins_api/wit/v0.1.0",
    // Generate the shared type separately so we can reference those types on each plugin
    // kind to avoid duplicating those generated types and all the mapping happens afterwords.
    world: "chipmunk:shared/bindings",
    additional_derives: [Clone],
    async: {
        only_imports: [],
    }
});

impl From<InitError> for PluginGuestError {
    fn from(value: InitError) -> Self {
        use PluginGuestError as GuestErr;
        match value {
            InitError::Config(msg) => GuestErr::Config(msg),
            InitError::Io(msg) => GuestErr::IO(msg),
            InitError::Unsupported(msg) => GuestErr::Unsupported(msg),
            InitError::Other(msg) => GuestErr::Other(msg),
        }
    }
}

impl From<HostConfValue> for ConfigValue {
    fn from(value: HostConfValue) -> Self {
        match value {
            HostConfValue::Boolean(val) => ConfigValue::Boolean(val),
            HostConfValue::Integer(val) => ConfigValue::Integer(val),
            HostConfValue::Float(val) => ConfigValue::Float(val),
            HostConfValue::Text(val) => ConfigValue::Text(val),
            HostConfValue::Files(val) => ConfigValue::Files(
                val.into_iter()
                    .map(|p| p.to_string_lossy().to_string())
                    .collect(),
            ),
            HostConfValue::Directories(val) => ConfigValue::Directories(
                val.into_iter()
                    .map(|p| p.to_string_lossy().to_string())
                    .collect(),
            ),
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

impl From<ConfigSchemaType> for HostSchemaType {
    fn from(value: ConfigSchemaType) -> Self {
        match value {
            ConfigSchemaType::Boolean(val) => HostSchemaType::Boolean(val),
            ConfigSchemaType::Integer(val) => HostSchemaType::Integer(val),
            ConfigSchemaType::Float(val) => HostSchemaType::Float(val),
            ConfigSchemaType::Text(val) => HostSchemaType::Text(val),
            ConfigSchemaType::Directories => HostSchemaType::Directories,
            ConfigSchemaType::Files(val) => HostSchemaType::Files(val),
            ConfigSchemaType::Dropdown(val) => HostSchemaType::Dropdown(val),
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

impl From<Version> for HostVersion {
    fn from(value: Version) -> Self {
        Self::new(value.major, value.minor, value.patch)
    }
}

impl From<ColumnInfo> for stypes::ColumnInfo {
    fn from(value: ColumnInfo) -> Self {
        Self {
            caption: value.caption,
            description: value.description,
            width: value.width,
        }
    }
}
