mod protobuf;

pub(crate) use plugins_api::{
    config, log,
    parser::{ParseError, ParseReturn, Parser, ParserConfig, RenderOptions},
    shared_types::{ConfigItem, ConfigSchemaItem, ConfigSchemaType, InitError, Version},
};
use plugins_api::{
    parser::{ColumnsRenderOptions, ParseYield, ParsedMessage},
    shared_types::ColumnInfo,
};
use std::iter;

pub(crate) use protobuf::*;

const DESCRIPTOR_FILE_PATH: &str = "descriptor_file_path";

impl Parser for ProtobufParser {
    fn get_version() -> Version {
        Version::new(0, 1, 0)
    }

    /// This parser requires a mandatory path to the protobuf descriptor file.
    fn get_config_schemas() -> Vec<ConfigSchemaItem> {
        vec![ConfigSchemaItem::new(
            DESCRIPTOR_FILE_PATH,
            "Descriptor File",
            Some("The path to the descriptor file (*.desc)"),
            ConfigSchemaType::Files(Vec::new()),
        )]
    }

    /// The data is displayed in two columns: the first column, MESSAGE, contains the name of the descriptor
    /// message that was successfully used for parsing. The second column, PAYLOAD, contains the message content.
    /// If parsing fails, the PAYLOAD column will display the raw packet bytes in HEX format.
    fn get_render_options() -> RenderOptions {
        let cols = vec![
            // Show the detected message descriptor name. If there are multiple matches, display all of them.
            ColumnInfo::new("MESSAGE", "Message", 150),
            // Show the decoding status. If all incoming bytes were successfully processed, display "OK";
            // otherwise, show the number of unprocessed bytes.
            ColumnInfo::new("Status", "Decoding Status", 100),
            // Show the decoded message. If decoding fails, display the raw content in HEX format.
            ColumnInfo::new("PAYLOAD", "Payload", -1),
        ];

        let columns_opts = ColumnsRenderOptions::new(cols, 30, 600);

        RenderOptions::new(Some(columns_opts))
    }

    fn create(gen_cfg: ParserConfig, plugin_cfg: Vec<ConfigItem>) -> Result<Self, InitError>
    where
        Self: Sized,
    {
        log::debug!("Got following general configurations: {:?}", gen_cfg);

        log::trace!("Reading and validating provided configurations");

        let Some(descriptor) = config::get_as_files(DESCRIPTOR_FILE_PATH, &plugin_cfg)?.first()
        else {
            return Err(InitError::Config(
                "Expecting protobuf descriptor file to decode messages".to_string(),
            ));
        };

        Ok(Self::new(descriptor)?)
    }

    fn parse(
        &mut self,
        data: &[u8],
        _tm: Option<u64>,
    ) -> Result<impl Iterator<Item = ParseReturn>, ParseError> {
        fn item<S: AsRef<str>>(name: S, msg: S, msg_len: u64, len: u64) -> ParseReturn {
            ParseReturn::new(
                len,
                Some(ParseYield::Message(ParsedMessage::Columns(vec![
                    name.as_ref().to_string(),
                    if msg_len == len {
                        "OK".to_owned()
                    } else {
                        format!("{}b not decoded", len - msg_len)
                    },
                    msg.as_ref().to_string(),
                ]))),
            )
        }
        let len = data.len();
        let msg = self.one_of_any(data);
        if msg.is_none() {
            log::warn!("Fail to decode bytes {:x?}", data);
        }
        let msg = self
            .one_of_any(data)
            .map(|(name, msg_len, msg)| item(name, msg.to_text_format(), msg_len, len as u64))
            .or_else(|| Some(item("_", &format!("{:X?}", data), 0, len as u64)));
        Ok(iter::successors(msg, |_| None))
    }
}

plugins_api::parser_export!(ProtobufParser);
