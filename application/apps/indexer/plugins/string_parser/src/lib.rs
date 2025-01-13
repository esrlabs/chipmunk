use core::str;
use std::iter;

use memchr::memchr;
use plugins_api::{
    log,
    parser::{
        ConfigItem, ConfigSchemaItem, ConfigSchemaType, ConfigValue, InitError, ParseError,
        ParseReturn, ParseYield, ParsedMessage, Parser, ParserConfig, RenderOptions, Version,
    },
    parser_export,
};

const LOSSY_ID: &str = "lossy";
const PREFIX_ID: &str = "prefix";

/// Simple struct that converts the given bytes into UTF-8 Strings line by line.
///
/// This parser will ignore invalid characters if [`Self::lossy`] is set to true, otherwise
/// it'll return a parsing error.
///
/// I can add an optional [`Self::prefix`] for each parsed item.
pub struct StringTokenizer {
    lossy: bool,
    prefix: Option<String>,
}

impl StringTokenizer {
    /// Converts a slice from the given data to UTF-8 String stopping when it hit the first
    /// break-line character to return one line at a time.
    ///
    /// # Panic:
    /// The function will panic is the provided data is empty.
    fn parse_line(&self, data: &[u8]) -> Result<ParseReturn, ParseError> {
        assert!(!data.is_empty(), "Provided data can't be empty");

        let end_idx = memchr(b'\n', data).unwrap_or_else(|| data.len() - 1);
        let slice = &data[..end_idx];

        let mut line = if self.lossy {
            String::from_utf8_lossy(slice).to_string()
        } else {
            std::str::from_utf8(slice)
                .map(|str| str.to_owned())
                .map_err(|err| {
                    ParseError::Parse(format!("Converting to UTF-8 failed. Error {err}"))
                })?
        };

        if let Some(prefix) = self.prefix.as_ref() {
            line = format!("{prefix} {line}");
        }
        let msg = ParsedMessage::Line(line);
        let yld = ParseYield::Message(msg);

        Ok(ParseReturn::new((end_idx + 1) as u64, Some(yld)))
    }
}

/// Struct must implement [`Parser`] trait to be compiled as a parser plugin in Chipmunk.
impl Parser for StringTokenizer {
    fn get_version() -> Version {
        Version::new(0, 1, 0)
    }

    fn get_config_schemas() -> Vec<ConfigSchemaItem> {
        vec![
            ConfigSchemaItem::new(
                LOSSY_ID,
                "Parse Lossy",
                Some("Parse UTF-8 including invalid characters"),
                ConfigSchemaType::Boolean,
            ),
            ConfigSchemaItem::new(
                PREFIX_ID,
                "Custom Prefix",
                Some("Specify custom prefix for each line"),
                ConfigSchemaType::Text,
            ),
        ]
    }

    fn get_render_options() -> RenderOptions {
        // String Tokenizer doesn't use headers
        RenderOptions::default()
    }

    fn create(
        general_configs: ParserConfig,
        plugins_configs: Vec<ConfigItem>,
    ) -> Result<Self, InitError>
    where
        Self: Sized,
    {
        // *** Demonstrates log functionality ***
        log::debug!(
            "Plugin initialize called with the general settings: {:?}",
            general_configs
        );

        log::info!(
            "Plugin initialize called with the custom configs: {:?}",
            plugins_configs
        );

        //TODO AAZ: Disabled for now since this plugin is used in benchmarks.
        // // *** Demonstrates writing to std console ***
        // println!(
        //     "From Plugin to Stdout: Initialize called with the {} custom configs.",
        //     plugins_configs.len()
        // );

        // eprintln!(
        //     "From Plugin to Stderr: Log level is {:?}",
        //     general_configs.log_level
        // );

        // *** Configurations validation ***
        let lossy_config_item = plugins_configs
            .iter()
            .find(|item| item.id == LOSSY_ID)
            .ok_or_else(|| {
                InitError::Config(format!(
                    "No configuration value for id '{LOSSY_ID}' is provided"
                ))
            })?;

        let lossy = match &lossy_config_item.value {
            ConfigValue::Boolean(lossy) => *lossy,
            invalid => {
                let err_msg = format!(
                    "Invalid config value for '{LOSSY_ID}' was provided. Value: {:?}",
                    invalid
                );
                return Err(InitError::Config(err_msg));
            }
        };

        let prefix_config_item = plugins_configs
            .iter()
            .find(|item| item.id == PREFIX_ID)
            .ok_or_else(|| {
                InitError::Config(format!(
                    "No configuration value for id '{PREFIX_ID}' is provided"
                ))
            })?;

        let prefix = match &prefix_config_item.value {
            ConfigValue::Text(txt) if txt.is_empty() => None,
            ConfigValue::Text(txt) => Some(txt.to_owned()),
            invalid => {
                let err_msg = format!(
                    "Invalid config value for '{PREFIX_ID}' is provided. Value: {invalid:?}"
                );
                return Err(InitError::Config(err_msg));
            }
        };

        // *** Plugin initialization ***
        Ok(Self { lossy, prefix })
    }

    fn parse(
        &mut self,
        data: &[u8],
        _timestamp: Option<u64>,
    ) -> Result<impl Iterator<Item = ParseReturn>, ParseError> {
        let mut slice = data;

        // Return early if function errors on the first call.
        let first_res = self.parse_line(slice)?;

        // Otherwise keep parsing and stop on first error, returning the parsed items at the end.
        let iter = iter::successors(Some(first_res), move |res| {
            slice = &slice[res.consumed as usize..];

            if slice.is_empty() {
                return None;
            }

            self.parse_line(slice).ok()
        });

        Ok(iter)
    }
}

parser_export!(StringTokenizer);
