use crate::parser_shared as shared;
use crate::{
    parser_shared::COLUMN_SEP, semantic_version::SemanticVersion, PluginGuestInitError,
    PluginParseMessage,
};

pub use self::chipmunk::plugin::{parse_types::*, shared_types::*};

use stypes::PluginConfigValue as HostConfValue;

wasmtime::component::bindgen!({
    path: "../plugins_api/wit/v_0.1.0/",
    world: "parse-plugin",
    async: {
        only_imports: [],
    },
});

impl From<&stypes::PluginParserGeneralSettings> for ParserConfig {
    fn from(_value: &stypes::PluginParserGeneralSettings) -> Self {
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

impl From<InitError> for PluginGuestInitError {
    fn from(value: InitError) -> Self {
        use PluginGuestInitError as GuestErr;
        match value {
            InitError::Config(msg) => GuestErr::Config(msg),
            InitError::Io(msg) => GuestErr::IO(msg),
            InitError::Unsupported(msg) => GuestErr::Unsupported(msg),
            InitError::Other(msg) => GuestErr::Other(msg),
        }
    }
}

use parsers as p;

impl From<ParseYield> for p::ParseYield<PluginParseMessage> {
    fn from(yld: ParseYield) -> Self {
        match yld {
            ParseYield::Message(msg) => p::ParseYield::Message(msg.into()),
            ParseYield::Attachment(att) => p::ParseYield::Attachment(att.into()),
            ParseYield::MessageAndAttachment((msg, att)) => {
                p::ParseYield::MessageAndAttachment((msg.into(), att.into()))
            }
        }
    }
}

impl From<Attachment> for p::Attachment {
    fn from(att: Attachment) -> Self {
        p::Attachment {
            data: att.data,
            name: att.name,
            size: att.size as usize,
            messages: att.messages.into_iter().map(|n| n as usize).collect(),
            created_date: att.created_date,
            modified_date: att.modified_date,
        }
    }
}

impl From<ParseError> for p::Error {
    fn from(err: ParseError) -> Self {
        match err {
            ParseError::Unrecoverable(msg) => p::Error::Unrecoverable(msg),
            ParseError::Parse(msg) => p::Error::Parse(msg),
            ParseError::Incomplete => p::Error::Incomplete,
            ParseError::Eof => p::Error::Eof,
        }
    }
}

impl From<ParsedMessage> for PluginParseMessage {
    fn from(msg: ParsedMessage) -> Self {
        let content = match msg {
            ParsedMessage::Line(msg) => msg,
            ParsedMessage::Columns(columns) => columns.join(COLUMN_SEP),
        };

        Self { content }
    }
}

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

impl From<RenderOptions> for shared::ParserRenderOptions {
    fn from(value: RenderOptions) -> Self {
        Self {
            headers: value.headers,
        }
    }
}
