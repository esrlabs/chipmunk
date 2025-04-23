//! Provides types, methods and macros to write plugins that provide parser functionality.
//!

use crate::shared_types::{ColumnInfo, ConfigItem, ConfigSchemaItem, InitError, Version};

// Module must be public because the generated types and macros are used within `parser_export!`
// macro + macros can't be re-exported via pub use
/// Generated types from parser world in WIT file by the macro [`wit_bindgen::generate`]
/// This is not part of the crate's public API and is subject to change at any time
#[doc(hidden)]
pub mod __internal_bindings {
    wit_bindgen::generate!({
        path: "wit/v0.1.0",
        world: "chipmunk:parser/parse",
        with: {
            "chipmunk:shared/logging@0.1.0": crate::logging,
            "chipmunk:shared/shared-types@0.1.0": crate::shared_types,
            "chipmunk:shared/sandbox@0.1.0": crate::sandbox,
        },
        additional_derives: [Clone],
        // Export macro is used withing the exported `parser_export!` macro and must be public
        pub_export_macro: true,
        // Bindings for export macro must be set, because it won't be called from withing the
        // same module where `generate!` is called
        default_bindings_module: "$crate::parser::__internal_bindings",
    });
}

// External exports for users
pub use __internal_bindings::chipmunk::parser::parse_types::{
    Attachment, ColumnsRenderOptions, ParseError, ParseReturn, ParseYield, ParsedMessage,
    ParserConfig, RenderOptions,
};

impl RenderOptions {
    /// Creates a new instance of render options with the given arguments
    pub fn new(columns_options: Option<ColumnsRenderOptions>) -> Self {
        Self { columns_options }
    }
}

// This type is generated be macro and we still can't set derive implementations
// on specific types with bindgen macro currently.
#[allow(clippy::derivable_impls)]
impl Default for RenderOptions {
    fn default() -> Self {
        Self {
            columns_options: None,
        }
    }
}

impl ColumnsRenderOptions {
    /// Creates a new instance of columns render options with the given arguments
    pub fn new(columns: Vec<ColumnInfo>, min_width: u16, max_width: u16) -> Self {
        Self {
            columns,
            max_width,
            min_width,
        }
    }
}

impl ColumnInfo {
    /// Creates a new instance of column render infos with the given arguments
    pub fn new<S: Into<String>>(caption: S, description: S, width: i16) -> Self {
        Self {
            caption: caption.into(),
            description: description.into(),
            width,
        }
    }
}

/// Trait representing a parser for Chipmunk plugins. Types that need to be
/// exported as parser plugins for use within Chipmunk must implement this trait.
pub trait Parser {
    /// Provides the current semantic version of the plugin.
    ///
    /// # Note
    /// This version is for the plugin only and is different from the plugin's API version.
    ///
    /// # Returns
    /// A `Version` struct representing the current version of the plugin.
    fn get_version() -> Version;

    /// Provides the schemas for the configurations required by the plugin, which
    /// must be specified by the users.
    ///
    /// These schemas define the expected structure, types, and constraints
    /// for plugin-specific configurations. The values of these configurations
    /// will be passed to the [`Parser::create()`] method for initializing the parser.
    ///
    /// # Returns
    ///
    /// A `Vec` of [`ConfigSchemaItem`] objects, where each item represents
    /// a schema for a specific plugin configuration.
    fn get_config_schemas() -> Vec<ConfigSchemaItem>;

    /// Provides the custom render options to be rendered in log view, enabling the users to
    /// change the visibility on the log columns when provided.
    ///
    /// # Note
    /// This function can be called before initializing the plugin instance.
    fn get_render_options() -> RenderOptions;

    /// Creates an instance of the parser. This method initializes the parser,
    /// configuring it with the provided settings and preparing it to perform parsing.
    ///
    /// # Parameters
    ///
    /// * `general_configs` - General configurations that apply to all parser plugins.
    /// * `plugins_configs` - Plugin-specific configurations, with their schemas provided
    ///   in [`Parser::get_config_schemas()`] method.
    ///
    /// # Returns
    ///
    /// A `Result` containing an instance of the implementing type on success, or an `InitError` on failure.
    fn create(
        general_configs: ParserConfig,
        plugins_configs: Vec<ConfigItem>,
    ) -> Result<Self, InitError>
    where
        Self: Sized;

    /// Parses the provided data and returns an iterator over the parse results.
    ///
    /// # Parameters
    ///
    /// * `data` - A slice of bytes representing the data to be parsed.
    /// * `timestamp` - An optional timestamp associated with the data.
    ///
    /// # Returns
    ///
    /// An iterator over `Result<ParseReturn, ParseError>` items. Each item represents either a successful parse result
    /// or a parse error.
    fn parse(
        &mut self,
        data: &[u8],
        timestamp: Option<u64>,
    ) -> Result<impl Iterator<Item = ParseReturn>, ParseError>;
}

impl ParseReturn {
    /// Creates a new instance from the given arguments.
    pub fn new(consumed: u64, value: Option<ParseYield>) -> Self {
        Self { value, consumed }
    }
}

#[macro_export]
/// Registers the provided type as parser plugin to use within Chipmunk
///
/// The type must implement the [`Parser`] trait.
///
/// # Examples
///
/// ```
/// # use plugins_api::parser::{Parser, RenderOptions, ParserConfig, ParseReturn, ParseError};
/// # use plugins_api::parser_export;
/// # use plugins_api::shared_types::{Version, ConfigSchemaItem, ConfigItem, InitError};
///
/// struct CustomParser;
///
/// impl Parser for CustomParser {
///   // ... //
///  #    fn get_version() -> Version {
///  #       Version::new(0, 1, 0)
///  #    }
///  #
///  #    fn get_config_schemas() -> Vec<ConfigSchemaItem> {
///  #       vec![]
///  #    }
///  #
///  #    fn get_render_options() -> RenderOptions {
///  #       RenderOptions::default()
///  #    }
///  #
///  #    fn create(
///  #        _general_configs: ParserConfig,
///  #        _plugins_configs: Vec<ConfigItem>,
///  #    ) -> Result<Self, InitError>
///  #    where
///  #        Self: Sized,
///  #    {
///  #        Ok(Self)
///  #    }
///  #
///  #    fn parse(
///  #        &mut self,
///  #        _data: &[u8],
///  #        _timestamp: Option<u64>,
///  #    ) -> Result<impl Iterator<Item = ParseReturn>, ParseError> {
///  #        Ok(std::iter::empty())
///  #    }
/// }
///
/// parser_export!(CustomParser);
/// ```
macro_rules! parser_export {
    ($par:ty) => {
        // Define parser instance as static field to make it reachable from
        // within parse function
        static PARSER: std::sync::Mutex<::std::option::Option<$par>> =
            std::sync::Mutex::new(::std::option::Option::None);

        // Define logger as static field to use it with macro initialization
        use $crate::__PluginLogSend;
        use $crate::__PluginLogger;
        static LOGGER: __PluginLogger<__PluginLogSend> = __PluginLogger {
            sender: __PluginLogSend,
        };

        // Name intentionally lengthened to avoid conflict with user's own types
        struct InternalPluginParserGuest;

        impl $crate::parser::__internal_bindings::exports::chipmunk::parser::parser::Guest
            for InternalPluginParserGuest
        {
            /// Provides the current semantic version of the plugin.
            /// This version is for the plugin only and is different from the plugin's API version.
            fn get_version() -> $crate::shared_types::Version {
                <$par as $crate::parser::Parser>::get_version()
            }

            /// Provides the schemas for the configurations needed by the plugin to
            /// be specified by the users.
            fn get_config_schemas() -> ::std::vec::Vec<$crate::shared_types::ConfigSchemaItem> {
                <$par as $crate::parser::Parser>::get_config_schemas()
            }

            fn get_render_options() -> $crate::parser::RenderOptions {
                <$par as $crate::parser::Parser>::get_render_options()
            }

            /// Initialize the parser with the given configurations
            fn init(
                general_configs: $crate::parser::ParserConfig,
                plugin_configs: ::std::vec::Vec<$crate::shared_types::ConfigItem>,
            ) -> ::std::result::Result<(), $crate::shared_types::InitError> {
                // Logger initialization
                let level = $crate::log::__Level::from(general_configs.log_level);
                $crate::log::__set_logger(&LOGGER)
                    .map(|()| $crate::log::__set_max_level(level.to_level_filter()))
                    .expect("Logger can be set on initialization only");

                // Initializing the given parser
                let parser =
                    <$par as $crate::parser::Parser>::create(general_configs, plugin_configs)?;
                *PARSER.lock().expect("Acquiring global parser failed") =
                    ::std::option::Option::Some(parser);

                Ok(())
            }

            /// Parse the given bytes returning a list of plugins results
            fn parse(
                data: ::std::vec::Vec<u8>,
                timestamp: ::std::option::Option<u64>,
            ) -> ::std::result::Result<
                ::std::vec::Vec<$crate::parser::ParseReturn>,
                $crate::parser::ParseError,
            > {
                use $crate::parser::{ParseYield, ParsedMessage, Parser};

                let mut parser_guard = PARSER.lock().expect("Acquiring global parser failed");
                let parser = parser_guard.as_mut().expect("parser already initialized");

                // HACK:
                // Combine the columns of each message on the plugin side before sending them
                // to the host to improve performance significantly (~25%).
                //
                // Sending messages as fragmented vectors requires multiple `memcpy()` calls
                // and individual pointer updates, which is inefficient. Instead, we allocate all
                // columns into a single vector before transmission, reducing overhead.
                //
                // This approach preserves the expected output by using the same delimiter as Chipmunk,
                // ensuring compatibility with the host’s message handling logic.
                //
                // Same separator is used in Chipmunk host.
                pub const COLUMN_SEP: &str = "\u{0004}";

                parser.parse(&data, timestamp).map(|items| {
                    items
                        .map(|mut item| {
                            if let Some(val) = item.value.as_mut() {
                                match val {
                                    ParseYield::Message(parsed_message)
                                    | ParseYield::MessageAndAttachment((parsed_message, _)) => {
                                        match parsed_message {
                                            ParsedMessage::Line(_) => {}
                                            ParsedMessage::Columns(vec) => {
                                                *parsed_message =
                                                    ParsedMessage::Line(vec.join(COLUMN_SEP))
                                            }
                                        }
                                    }
                                    ParseYield::Attachment(_) => {}
                                }
                            }

                            item
                        })
                        .collect()
                })
            }
        }

        // Call the generated export macro from wit-bindgen
        $crate::parser::__internal_bindings::export!(InternalPluginParserGuest);
    };
}

// This module is used for quick feedback while developing the macro by commenting out the cfg
// attribute. After developing is done the attribute should be put back so this module won't be
// compiled in all real use cases;
#[cfg(test)]
mod prototyping {
    struct Dummy;

    impl crate::parser::Parser for Dummy {
        fn get_version() -> crate::shared_types::Version {
            todo!()
        }

        fn get_config_schemas() -> Vec<crate::shared_types::ConfigSchemaItem> {
            todo!()
        }

        fn get_render_options() -> crate::parser::RenderOptions {
            todo!()
        }

        fn create(
            _general_configs: crate::parser::ParserConfig,
            _plugins_configs: Vec<crate::shared_types::ConfigItem>,
        ) -> Result<Self, crate::shared_types::InitError>
        where
            Self: Sized,
        {
            todo!()
        }

        fn parse(
            &mut self,
            _data: &[u8],
            _timestamp: Option<u64>,
        ) -> Result<impl Iterator<Item = crate::parser::ParseReturn>, crate::parser::ParseError>
        {
            Ok(std::iter::empty())
        }
    }

    crate::parser_export!(Dummy);
}
