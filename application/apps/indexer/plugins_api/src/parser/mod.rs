//! Provides types, methods and macros to write plugins that provide parser functionality.
//!

mod logging;

// This is needed to be public because it's used in the export macro
#[doc(hidden)]
pub use logging::ParserLogSend as __ParserLogSend;

// Module must be public because the generated types and macros are used within `parser_export!`
// macro + macros can't be re-exported via pub use
/// Generated types from parser world in WIT file by the macro [`wit_bindgen::generate`]
/// This is not part of the crate's public API and is subject to change at any time
#[doc(hidden)]
pub mod __internal_bindings {
    wit_bindgen::generate!({
        path: "wit/v_0.1.0",
        world: "parse-plugin",
        // Export macro is used withing the exported `parser_export!` macro and must be public
        pub_export_macro: true,
        // Bindings for export macro must be set, because it won't be called from withing the
        // same module where `generate!` is called
        default_bindings_module: "$crate::parser::__internal_bindings",
    });
}

// External exports for users
pub use __internal_bindings::chipmunk::plugin::{
    logging::Level,
    parse_types::{Attachment, ParseError, ParseReturn, ParseYield, ParsedMessage, ParserConfig},
    shared_types::{ConfigItem, ConfigSchemaItem, ConfigSchemaType, ConfigValue, InitError},
};

impl ConfigSchemaItem {
    /// Creates a configuration schema item with the given arguments.
    pub fn new<S: Into<String>>(
        id: S,
        title: S,
        description: Option<S>,
        input_type: ConfigSchemaType,
    ) -> Self {
        Self {
            id: id.into(),
            title: title.into(),
            description: description.map(|d| d.into()),
            input_type,
        }
    }
}

/// Trait representing a parser for Chipmunk plugins. Types that need to be
/// exported as parser plugins for use within Chipmunk must implement this trait.
pub trait Parser {
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
/// # use plugins_api::parser::*;
/// # use plugins_api::*;
///
/// struct CustomParser;
///
/// impl Parser for CustomParser {
///   // ... //
///  #    fn get_config_schemas() -> Vec<ConfigSchemaItem> {
///  #       vec![]
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
        static mut PARSER: ::std::option::Option<$par> = ::std::option::Option::None;

        // Define logger as static field to use it with macro initialization
        use $crate::__PluginLogger;
        use $crate::parser::__ParserLogSend;
        static LOGGER: __PluginLogger<__ParserLogSend> = __PluginLogger {
            sender: __ParserLogSend,
        };

        // Name intentionally lengthened to avoid conflict with user's own types
        struct InternalPluginParserGuest;

        impl $crate::parser::__internal_bindings::exports::chipmunk::plugin::parser::Guest
            for InternalPluginParserGuest
        {
            /// Provides the schemas for the configurations needed by the plugin to
            /// be specified by the users.
            fn get_config_schemas() -> ::std::vec::Vec<$crate::parser::ConfigSchemaItem> {
                <$par as $crate::parser::Parser>::get_config_schemas()
            }

            /// Initialize the parser with the given configurations
            fn init(
                general_configs: $crate::parser::ParserConfig,
                plugin_configs: ::std::vec::Vec<$crate::parser::ConfigItem>,
            ) -> ::std::result::Result<(), $crate::parser::InitError> {
                // Logger initialization
                let level = $crate::log::Level::from(general_configs.log_level);
                $crate::log::set_logger(&LOGGER)
                    .map(|()| $crate::log::set_max_level(level.to_level_filter()))
                    .expect("Logger can be set on initialization only");

                // Initializing the given parser
                let parser =
                    <$par as $crate::parser::Parser>::create(general_configs, plugin_configs)?;
                // SAFETY: Initializing the parser happens once only on the host
                unsafe {
                    PARSER = ::std::option::Option::Some(parser);
                }

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
                // SAFETY: Parse method has mutable reference to self and can't be called more than
                // once on the same time on host
                //TODO AAZ: Find better way than denying the warning.
                #[allow(static_mut_refs)]
                let parser = unsafe { PARSER.as_mut().expect("parser already initialized") };
                parser.parse(&data, timestamp).map(|items| items.collect())
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
    use super::*;

    struct Dummy;

    impl Parser for Dummy {
        fn get_config_schemas() -> Vec<ConfigSchemaItem> {
            todo!()
        }

        fn create(
            _general_configs: ParserConfig,
            _plugins_configs: Vec<ConfigItem>,
        ) -> Result<Self, InitError>
        where
            Self: Sized,
        {
            todo!()
        }

        fn parse(
            &mut self,
            _data: &[u8],
            _timestamp: Option<u64>,
        ) -> Result<impl Iterator<Item = ParseReturn>, ParseError> {
            Ok(std::iter::empty())
        }
    }

    parser_export!(Dummy);
}
