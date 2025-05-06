use plugins_api::{
    config, log,
    parser::{ColumnsRenderOptions, ParseError, ParseReturn, Parser, ParserConfig, RenderOptions},
    parser_export,
    shared_types::{
        ColumnInfo, ConfigItem, ConfigSchemaItem, ConfigSchemaType, InitError, Version,
    },
};

// IDs for plugin configurations
const MY_BOOL_CONFIG_ID: &str = "my_bool_config";
const MY_TEXT_CONIFG_ID: &str = "my_text_config";

/// Struct representing a parser plugin for Chipmunk.  
/// It must implement the [`Parser`] trait to be recognized and used as a plugin.
pub struct MyParser {}

impl Parser for MyParser {
    fn get_version() -> Version {
        // Specify the version of the plugin here.
        Version::new(0, 1, 0)
    }

    fn get_config_schemas() -> Vec<ConfigSchemaItem> {
        // Defines schema configurations required by the plugin, which users must specify.
        // These schemas are rendered in the UI and presented to users when starting a parsing session.
        // The provided values are then passed to the plugin during session initialization.

        let my_bool_default = true;
        let my_text_dafault = String::new();
        vec![
            ConfigSchemaItem::new(
                MY_BOOL_CONFIG_ID,
                "My Boolean Config",
                Some("Example for boolean configuration item"),
                ConfigSchemaType::Boolean(my_bool_default),
            ),
            ConfigSchemaItem::new(
                MY_TEXT_CONIFG_ID,
                "My Text Config",
                Some("Example for text configuration item"),
                ConfigSchemaType::Text(my_text_dafault),
            ),
        ]
    }

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
        _general_configs: ParserConfig,
        plugins_configs: Vec<ConfigItem>,
    ) -> Result<Self, InitError>
    where
        Self: Sized,
    {
        // Initializes the parser with the given configurations, preparing it for the
        // parsing session.

        let my_bool_value = config::get_as_boolean(MY_BOOL_CONFIG_ID, &plugins_configs)?;
        // This will be written into Chipmunk logs
        log::debug!("My bool value is {my_bool_value}");

        let my_text_value = config::get_as_text(MY_TEXT_CONIFG_ID, &plugins_configs)?;
        // This will be written to standard output.
        println!("PARSER PLUGIN: My text value is {my_text_value}");

        Ok(Self {})
    }

    fn parse(
        &mut self,
        _data: &[u8],
        _timestamp: Option<u64>,
    ) -> Result<impl Iterator<Item = ParseReturn>, ParseError> {
        // Parses the provided bytes and returns the results.
        // This method is called repeatedly as more data becomes available.
        // If the parser encounters a recoverable parsing error while it already has some parsed
        // items, it should return those items and not the error.
        // The parse will be called again with the remaining bytes + newly loaded bytes.
        Ok(std::iter::empty())
    }
}

parser_export!(MyParser);
