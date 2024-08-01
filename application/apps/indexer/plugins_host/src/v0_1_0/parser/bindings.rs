use crate::{PluginGuestInitError, PluginParseMessage};
use sources::factory::PluginParserGeneralSetttings;

pub use self::chipmunk::plugin::{parse_types::*, shared_types::*};
//TODO AAZ: Check if `duplicate_if_necessary` should be set to true or false on both plugin and
// host sides
wasmtime::component::bindgen!({
    path: "../plugins_api/wit/v_0.1.0/",
    world: "parse-plugin",
    ownership: Borrowing {
        duplicate_if_necessary: true
    },
    async: {
        only_imports: [],
    },
});

impl From<&PluginParserGeneralSetttings> for ParserConfig {
    fn from(_value: &PluginParserGeneralSetttings) -> Self {
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
