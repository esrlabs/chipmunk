// TODO: Temporally place holder
#![allow(dead_code, unused_imports, unused)]

use std::path::{Path, PathBuf};

use wit_bindgen::generate;

use self::{
    chipmunk::plugin::{parse_types::*, shared_types::*},
    exports::chipmunk::plugin::parser::Guest,
};

generate!({
    path: "wit/v_0.1.0",
    world: "parse-plugin",
});

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
        //TODO AAZ: have all the types with the full path after defining the exports from wit file
        static mut PARSER: ::std::option::Option<$par> = ::std::option::Option::None;

        struct PluginParser;

        impl Guest for PluginParser {
            /// Initialize the parser with the given configurations
            fn init(
                general_configs: ParserConfig,
                plugin_configs: ::std::option::Option<::std::string::String>,
            ) -> ::std::result::Result<(), InitError> {
                let parser = <$par as $crate::Parser>::create(
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
                data: _rt::Vec<u8>,
                timestamp: ::std::option::Option<u64>,
            ) -> _rt::Vec<Result<ParseReturn, ParseError>> {
                // SAFETY: Parse method has mutable reference to self and can't be called more than
                // once on the same time on host
                let parser = unsafe { PARSER.as_mut().expect("parser already initialized") };
                parser.parse(&data, timestamp).into_iter().collect()
            }

            /// Parse the given bytes returning the results to the host one by one using the function `add` provided by the host.
            fn parse_with_add(data: _rt::Vec<u8>, timestamp: Option<u64>) {
                // SAFETY: Parse method has mutable reference to self and can't be called more than
                // once on the same time on host
                let parser = unsafe { PARSER.as_mut().expect("parser already initialized") };
                for item in parser.parse(&data, timestamp) {
                    add(item.as_ref());
                }
            }
        }

        export!(PluginParser);
    };
}

parser_export!(Dummy);
