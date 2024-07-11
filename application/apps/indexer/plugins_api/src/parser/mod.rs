// TODO: Temporally place holder
#![allow(dead_code, unused_imports, unused)]

use std::path::{Path, PathBuf};

use self::bindings::exports::chipmunk::plugin::parser::Guest;

mod bindings {
    use super::*;

    wit_bindgen::generate!({
        path: "wit/v_0.1.0",
        world: "parse-plugin",
        export_macro_name: "export_intern",
        // Export macro is used withing the exported `parser_export!` macro and must be public
        pub_export_macro: true,
        // Bindings for export macro must be set, because it won't be called from withing the
        // same module where `generate!` is called
        default_bindings_module: "crate::parser::bindings",
    });
}

// External exports for users
pub use bindings::chipmunk::plugin::{
    parse_types::{Attachment, ParseError, ParseReturn, ParseYield, ParserConfig},
    shared_types::InitError,
};
// Exports needed in macro but not needed by users
#[doc(hidden)]
pub use bindings::{
    add as add_res_intern, export_intern,
    exports::chipmunk::plugin::parser::Guest as PluginInternalGuest,
};

/// Chipmunk Parser Plugin
pub trait Parser {
    fn create(
        general_configs: ParserConfig,
        config_path: Option<PathBuf>,
    ) -> Result<Self, InitError>
    where
        Self: Sized;
    fn parse(
        &mut self,
        data: &[u8],
        timestamp: Option<u64>,
    ) -> impl IntoIterator<Item = Result<ParseReturn, ParseError>> + Send;
}

struct Dummy;

impl Parser for Dummy {
    fn create(
        general_configs: ParserConfig,
        config_path: Option<PathBuf>,
    ) -> Result<Self, InitError>
    where
        Self: Sized,
    {
        todo!()
    }

    fn parse(
        &mut self,
        data: &[u8],
        timestamp: Option<u64>,
    ) -> impl IntoIterator<Item = Result<ParseReturn, ParseError>> + Send {
        Vec::new()
    }
}

//************************* Macro start **********************************

#[macro_export]
macro_rules! parser_export {
    ($par:ty) => {
        static mut PARSER: ::std::option::Option<$par> = ::std::option::Option::None;

        // Name intentionally lengthened to avoid conflict with user's own types
        struct InternalPluginParserGuest;

        impl $crate::parser::PluginInternalGuest for InternalPluginParserGuest {
            /// Initialize the parser with the given configurations
            fn init(
                general_configs: $crate::parser::ParserConfig,
                plugin_configs: ::std::option::Option<::std::string::String>,
            ) -> ::std::result::Result<(), $crate::parser::InitError> {
                let parser = <$par as $crate::parser::Parser>::create(
                    general_configs,
                    plugin_configs.map(|path| path.into()),
                )?;
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
            ) -> ::std::vec::Vec<
                ::std::result::Result<$crate::parser::ParseReturn, $crate::parser::ParseError>,
            > {
                // SAFETY: Parse method has mutable reference to self and can't be called more than
                // once on the same time on host
                let parser = unsafe { PARSER.as_mut().expect("parser already initialized") };
                parser.parse(&data, timestamp).into_iter().collect()
            }

            /// Parse the given bytes returning the results to the host one by one using the function `add` provided by the host.
            fn parse_with_add(data: ::std::vec::Vec<u8>, timestamp: ::std::option::Option<u64>) {
                // SAFETY: Parse method has mutable reference to self and can't be called more than
                // once on the same time on host
                let parser = unsafe { PARSER.as_mut().expect("parser already initialized") };
                for item in parser.parse(&data, timestamp) {
                    $crate::parser::add_res_intern(item.as_ref());
                }
            }
        }

        $crate::parser::export_intern!(InternalPluginParserGuest);
    };
}

parser_export!(Dummy);
