use std::iter;

use dlt::DltParser;
use log_level::LogLevel;
use plugins_api::{
    config, log,
    parser::{ColumnsRenderOptions, ParseError, ParseReturn, Parser, ParserConfig, RenderOptions},
    shared_types::{
        ColumnInfo, ConfigItem, ConfigSchemaItem, ConfigSchemaType, InitError, Version,
    },
};

mod dlt;
mod log_level;

const LOG_LEVEL_ID: &str = "log_level";
const FIBEX_ID: &str = "fibex_id";
const STORAGE_HEADER_ID: &str = "storage_header_id";

impl Parser for DltParser {
    fn get_version() -> Version {
        Version::new(0, 1, 0)
    }

    fn get_config_schemas() -> Vec<ConfigSchemaItem> {
        vec![
            ConfigSchemaItem::new(
                STORAGE_HEADER_ID,
                "With storage header",
                None,
                ConfigSchemaType::Boolean(true),
            ),
            ConfigSchemaItem::new(
                LOG_LEVEL_ID,
                "Log level",
                Some("Select required level of logs"),
                ConfigSchemaType::Dropdown((
                    LogLevel::all()
                        .iter()
                        .map(|level| level.to_str().to_owned())
                        .collect(),
                    LogLevel::Verbose.to_str().to_owned(),
                )),
            ),
            ConfigSchemaItem::new(
                FIBEX_ID,
                "Fibex",
                Some("Attach fibex file (optional)"),
                ConfigSchemaType::Files(vec![String::from("xml")]),
            ),
        ]
    }

    fn get_render_options() -> RenderOptions {
        let cols = vec![
            ColumnInfo::new("Datetime", "Datetime", 150),
            ColumnInfo::new("ECUID", "ECU", 20),
            ColumnInfo::new("VERS", "Dlt Protocol Version (VERS)", 20),
            ColumnInfo::new("SID", "Session ID (SEID)", 20),
            ColumnInfo::new("MCNT", "Message counter (MCNT)", 20),
            ColumnInfo::new("TMS", "Timestamp (TMSP)", 20),
            ColumnInfo::new("EID", "ECU", 20),
            ColumnInfo::new("APID", "Application ID (APID)", 20),
            ColumnInfo::new("CTID", "Context ID (CTID)", 20),
            ColumnInfo::new("MSTP", "Message Type (MSTP)", 20),
            ColumnInfo::new("PAYLOAD", "Payload", -1),
        ];

        // Ensure generated headers count equals the length of the columns.
        assert_eq!(cols.len(), dlt::fmt::COLUMN_LEN);

        let columns_opts = ColumnsRenderOptions::new(cols, 30, 600);

        RenderOptions::new(Some(columns_opts))
    }

    fn create(
        general_configs: ParserConfig,
        plugins_configs: Vec<ConfigItem>,
    ) -> Result<Self, InitError>
    where
        Self: Sized,
    {
        log::debug!(
            "Got following general configurations: {:?}",
            general_configs
        );

        log::trace!("Reading and validating provided configurations");

        let with_storage_header = config::get_as_boolean(STORAGE_HEADER_ID, &plugins_configs)?;

        let log_level = config::get_as_dropdown(LOG_LEVEL_ID, &plugins_configs)?;
        let _log_level: LogLevel = log_level.parse().map_err(|error| {
            InitError::Config(format!(
                "Fail to parse provided log level value. Error: {error}"
            ))
        })?;

        // Filter config won't be used within this plugin. Since its main purpose is
        // comparing performance between plugin and native DLT parser.
        let filter_config = None;

        let fibex_files = config::get_as_files(FIBEX_ID, &plugins_configs)?;
        let fibex_dlt_metadata = if !fibex_files.is_empty() {
            dlt_core::fibex::gather_fibex_data(dlt_core::fibex::FibexConfig {
                fibex_file_paths: fibex_files.to_vec(),
            })
        } else {
            None
        };

        // Format options won't be used within the plugin as well.
        let fmt_options = None;

        Ok(Self::new(
            filter_config,
            fibex_dlt_metadata,
            fmt_options,
            with_storage_header,
        ))
    }

    fn parse(
        &mut self,
        data: &[u8],
        timestamp: Option<u64>,
    ) -> Result<impl Iterator<Item = ParseReturn>, ParseError> {
        let mut slice = data;

        // return early if function errors on first parse call.
        let first_res = self.parse_line(data, timestamp)?;

        // Otherwise keep parsing and stop on first error, returning the parsed items at the end.

        let iter = iter::successors(Some(first_res), move |res| {
            slice = &slice[res.consumed as usize..];

            if slice.is_empty() {
                return None;
            }

            self.parse_line(slice, timestamp).ok()
        });

        Ok(iter)
    }
}

plugins_api::parser_export!(DltParser);
