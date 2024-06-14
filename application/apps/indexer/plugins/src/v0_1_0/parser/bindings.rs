use crate::{PluginGuestInitError, PluginHostInitError, PluginParseMessage};
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

impl<'a> From<&'a PluginParserGeneralSetttings> for ParserConfig<'a> {
    fn from(value: &'a PluginParserGeneralSetttings) -> Self {
        Self {
            place_holder_config: &value.placeholder,
        }
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
