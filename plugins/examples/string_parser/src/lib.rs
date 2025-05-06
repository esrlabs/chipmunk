use core::str;
use std::{iter, ops::Not};

use memchr::memchr;
use plugins_api::{
    config::{self, get_as_text},
    log,
    parser::{
        ColumnsRenderOptions, ParseError, ParseReturn, ParseYield, ParsedMessage, Parser,
        ParserConfig, RenderOptions,
    },
    parser_export,
    sandbox::temp_directory,
    shared_types::{
        ColumnInfo, ConfigItem, ConfigSchemaItem, ConfigSchemaType, InitError, Version,
    },
};

// IDs for configurations needed for this plugin.
const LOSSY_ID: &str = "lossy";
const PREFIX_ID: &str = "prefix";

// IDs for configurations used as show-case only.
const INTEGER_ID: &str = "integer_idx";
const FLOAT_ID: &str = "float_idx";
const FILES_ID: &str = "files_idx";
const DIRS_ID: &str = "dirs_idx";
const DROPDOWN_ID: &str = "dropdown_idx";

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
    /// break-line character to return one line and its length at a time.
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

        let msgs = ParsedMessage::Columns(vec![line.len().to_string(), line]);
        let yld = ParseYield::Message(msgs);

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
                ConfigSchemaType::Boolean(true),
            ),
            ConfigSchemaItem::new(
                PREFIX_ID,
                "Custom Prefix",
                Some("Specify custom prefix for each line"),
                ConfigSchemaType::Text(String::new()),
            ),
            ConfigSchemaItem::new(
                INTEGER_ID,
                "Example Number",
                Some("Configuration item with integer"),
                ConfigSchemaType::Integer(32),
            ),
            ConfigSchemaItem::new(
                FLOAT_ID,
                "Example Float",
                Some("Configuration item with floating number"),
                ConfigSchemaType::Float(1.55),
            ),
            ConfigSchemaItem::new(
                FILES_ID,
                "Example File",
                Some("Configuration item with files"),
                ConfigSchemaType::Files(vec!["log".into(), "txt".into()]),
            ),
            ConfigSchemaItem::new(
                DIRS_ID,
                "Example Directories",
                Some("Configuration item with directories"),
                ConfigSchemaType::Directories,
            ),
            ConfigSchemaItem::new(
                DROPDOWN_ID,
                "Example Drop-Down",
                Some("Configuration item with drop-down"),
                ConfigSchemaType::Dropdown((
                    vec![
                        String::from("Option 1"),
                        String::from("Option 2"),
                        String::from("Option 3"),
                        String::from("Option 4"),
                    ],
                    String::from("Option 1"),
                )),
            ),
        ]
    }

    fn get_render_options() -> RenderOptions {
        // *** Demonstration of render options ***
        let columns = vec![
            ColumnInfo::new("Length", "The length of the log message", 30),
            ColumnInfo::new("Message", "The log message", -1),
        ];

        let columns_opts = ColumnsRenderOptions::new(columns, 30, 600);

        RenderOptions::new(Some(columns_opts))
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

        // *** Demonstrates writing to std console ***
        println!(
            "From Plugin to Stdout: Initialize called with the {} custom configs.",
            plugins_configs.len()
        );

        eprintln!(
            "From Plugin to Stderr: Log level is {:?}",
            general_configs.log_level
        );

        // *** Demonstrates plugins temporary directory.
        let temp_dir = temp_directory()
            .map_err(|err| InitError::Io(format!("Getting temp directory failed. {}", err)))?;

        log::info!("Plugin temp directory path: {}", temp_dir.display());

        // *** Configurations validation using the provided helper functions ***
        let lossy = config::get_as_boolean(LOSSY_ID, &plugins_configs)?;

        let prefix = get_as_text(PREFIX_ID, &plugins_configs)?;
        let prefix = prefix.is_empty().not().then(|| prefix.to_owned());

        // *** Printing configuration for debugging purpose ***
        for item in plugins_configs.iter() {
            match item.id.as_str() {
                LOSSY_ID => println!("Boolean config value is: {:?}", item.value),
                PREFIX_ID => println!("Text config value is: {:?}", item.value),
                INTEGER_ID => println!("Number config value is: {:?}", item.value),
                FLOAT_ID => println!("Float config value is: {:?}", item.value),
                FILES_ID => println!("Files config value is: {:?}", item.value),
                DIRS_ID => println!("Dirs config value is: {:?}", item.value),
                DROPDOWN_ID => println!("Drop-Down config value is: {:?}", item.value),
                unknown => {
                    let error_msg = format!("Unknown configuration ID: {unknown}");
                    return Err(InitError::Config(error_msg));
                }
            }
        }

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
