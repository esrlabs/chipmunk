use crate::{plugins_shared::PLUGIN_MSG_COLUMN_SEP, PluginParseMessage};

pub use self::chipmunk::parser::parse_types::*;

use stypes::ParserRenderOptions;

wasmtime::component::bindgen!({
    path: "../../../../plugins/plugins_api/wit/v0.1.0",
    world: "chipmunk:parser/parse",
    additional_derives: [Clone],
    // Activate async but shrink its interfaces as possible.
    // Without activating async, wasmtime will spawn new runtime on its own,
    // causing the app to panic because the app already have its own tokio runtime.
    async: {
        only_imports: [],
    },
    // Link shared types to avoid regenerating them.
    with: {
        "chipmunk:shared/logging@0.1.0": crate::v0_1_0::shared::logging,
        "chipmunk:shared/shared-types@0.1.0": crate::v0_1_0::shared::shared_types,
        "chipmunk:shared/sandbox@0.1.0": crate::v0_1_0::shared::sandbox,
    }
});

impl From<&stypes::PluginParserGeneralSettings> for ParserConfig {
    fn from(_value: &stypes::PluginParserGeneralSettings) -> Self {
        // We must use the current log level form chipmunk because we are using the same log
        // functionality to log the message from the plugins.
        let current_log_level = log::max_level().to_level().unwrap_or(log::Level::Error);

        use crate::v0_1_0::shared::logging::Level as PlugLevel;
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
            ParsedMessage::Columns(columns) => columns.join(PLUGIN_MSG_COLUMN_SEP),
        };

        Self { content }
    }
}

impl From<RenderOptions> for ParserRenderOptions {
    fn from(value: RenderOptions) -> Self {
        Self {
            columns_options: value.columns_options.map(|o| o.into()),
        }
    }
}

impl From<ColumnsRenderOptions> for stypes::ColumnsRenderOptions {
    fn from(value: ColumnsRenderOptions) -> Self {
        Self {
            columns: value.columns.into_iter().map(|c| c.into()).collect(),
            min_width: value.min_width,
            max_width: value.max_width,
        }
    }
}
