use core::str;
use std::{
    fs::File,
    io::{BufRead, BufReader},
    path::PathBuf,
};

use plugins_api::{
    config, log,
    parser::{ParseYield, ParsedMessage},
    producer::{ProduceError, ProduceReturn, Producer, ProducerConfig, RenderOptions},
    producer_export,
    shared_types::{
        ColumnInfo, ColumnsRenderOptions, ConfigItem, ConfigSchemaItem, ConfigSchemaType,
        InitError, Version,
    },
};

// IDs for configurations needed for this plugin.
const FILE_PATH_ID: &str = "file_path";

/// Simple struct that opens a text file returning its content line by line.
pub struct FileProducer {
    reader: BufReader<File>,
    line_buffer: String,
    items_buffer: Vec<ProduceReturn>,
}

impl Producer for FileProducer {
    fn get_version() -> Version {
        Version::new(0, 1, 0)
    }

    fn get_config_schemas() -> Vec<ConfigSchemaItem> {
        vec![ConfigSchemaItem::new(
            FILE_PATH_ID,
            "File Path",
            Some("Path for input text file"),
            ConfigSchemaType::Files(Vec::new()),
        )]
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
        general_configs: ProducerConfig,
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

        log::debug!(
            "Plugin initialize called with the custom configs: {:?}",
            plugins_configs
        );

        // *** Configurations validation using the provided helper functions ***

        let input_path = config::get_as_files(FILE_PATH_ID, &plugins_configs)?
            .first()
            .ok_or_else(|| InitError::Config(String::from("Provided input file paths is empty")))
            .map(PathBuf::from)?;

        // *** Plugins initialization ***
        let file = File::open(input_path).map_err(|err| InitError::Io(err.to_string()))?;
        let reader = BufReader::new(file);

        Ok(Self {
            reader,
            line_buffer: String::new(),
            items_buffer: Vec::with_capacity(5),
        })
    }

    fn produce_next(&mut self) -> Result<impl Iterator<Item = ProduceReturn>, ProduceError> {
        for _ in 0..self.items_buffer.capacity() {
            self.line_buffer.clear();
            self.reader
                .read_line(&mut self.line_buffer)
                .map_err(|err| {
                    ProduceError::Produce(format!("IO error while reading file: {err}"))
                })?;

            let msg = ParseYield::Message(ParsedMessage::Columns(vec![
                self.line_buffer.len().to_string(),
                self.line_buffer.to_owned(),
            ]));
            self.items_buffer.push(ProduceReturn::Item(msg));
        }

        Ok(self.items_buffer.drain(..))
    }
}

producer_export!(FileProducer);
