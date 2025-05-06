use std::path::PathBuf;

use plugins_api::{
    config,
    parser::{ParseYield, ParsedMessage},
    producer::{ProduceError, ProduceReturn, Producer, ProducerConfig, RenderOptions},
    producer_export,
    shared_types::{
        ColumnInfo, ColumnsRenderOptions, ConfigItem, ConfigSchemaItem, ConfigSchemaType,
        InitError, Version,
    },
};

// TODO AAZ: Update NOTES sections once integrated withing Chipmunk.

// IDs for configurations needed for this plugin.
const MY_BOOL_CONFIG_ID: &str = "my_bool_config";
const MY_FILE_PATH_ID: &str = "file_path";

/// Struct representing a producer plugin for Chipmunk.  
/// It must implement the [`Producer`] trait to be recognized and used as a plugin.
pub struct MyProducer {
    /// Counts the total number of messages sent to the host.
    counter: usize,
}

impl Producer for MyProducer {
    fn get_version() -> Version {
        // Specify the version of the plugin here.
        Version::new(0, 1, 0)
    }

    // NOTE: This section is currently ignored in Chipmunk app.
    fn get_config_schemas() -> Vec<ConfigSchemaItem> {
        // Defines schema configurations required by the plugin, which users must specify.
        // These schemas are rendered in the UI and presented to users when starting a producer session.
        // The provided values are then passed to the plugin during session initialization.

        let my_bool_default = true;
        let my_path_default = Vec::new();
        vec![
            ConfigSchemaItem::new(
                MY_BOOL_CONFIG_ID,
                "My Boolean Config",
                Some("Example for boolean configuration item"),
                ConfigSchemaType::Boolean(my_bool_default),
            ),
            ConfigSchemaItem::new(
                MY_FILE_PATH_ID,
                "File Path",
                Some("Path for input files"),
                ConfigSchemaType::Files(my_path_default),
            ),
        ]
    }

    // NOTE: This section is currently ignored in Chipmunk app.
    fn get_render_options() -> RenderOptions {
        // Defines custom render options for the log view, allowing users to control
        // the visibility of log columns when available.
        let col_width = 30;
        let columns = vec![ColumnInfo::new("Caption", "Description", col_width)];

        let min_width = 30;
        let max_width = 600;
        let columns_opts = ColumnsRenderOptions::new(columns, min_width, max_width);

        RenderOptions::new(Some(columns_opts))
    }

    fn create(
        _general_configs: ProducerConfig,
        plugins_configs: Vec<ConfigItem>,
    ) -> Result<Self, InitError>
    where
        Self: Sized,
    {
        // Initializes the producer with the given configurations, preparing it for the
        // producer session.

        // NOTE: This part is commented out until producer plugins are fully integrated in
        // Chipmunk.
        //
        // let my_bool_value = config::get_as_boolean(MY_BOOL_CONFIG_ID, &plugins_configs)?;
        // // This will be written into Chipmunk logs
        // log::debug!("My bool value is {my_bool_value}");

        // NOTE: Chipmunk will deliver the path for the selected file via this configuration
        // item temporally.
        let my_path_value: Vec<PathBuf> = config::get_as_files(MY_FILE_PATH_ID, &plugins_configs)?
            .iter()
            .map(PathBuf::from)
            .collect();
        // This will be written to standard output.
        println!("My bool value is {my_path_value:?}");

        Ok(Self { counter: 0 })
    }

    fn produce_next(&mut self) -> Result<impl Iterator<Item = ProduceReturn>, ProduceError> {
        // This method attempts to read from the underlying data source, process the information,
        // and returns a collection of successfully produced results. It should be called
        // repeatedly to consume all available data.
        //
        // The host will consider the production session from this plugin as done
        // once this method returns an empty iterator (i.e., the iterator yields no items)
        // or yields an item with the variant `ProduceReturn::Done`.

        // This producer delivers up to 5 messages at a time per call,
        // and stops after a total of 100 messages have been delivered.
        let iter = std::iter::repeat_with(|| {
            self.counter += 1;
            self.counter
        })
        .take(5)
        .map(|num| {
            if num <= 100 {
                ProduceReturn::Item(ParseYield::Message(ParsedMessage::Line(format!(
                    "Message number {num} from producer plugin"
                ))))
            } else {
                ProduceReturn::Done
            }
        });

        Ok(iter)
    }
}

producer_export!(MyProducer);
