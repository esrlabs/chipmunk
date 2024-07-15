use std::path::PathBuf;

// Module must be public because the generated types and macros are used within `parser_export!`
// macro + macros can't be re-exported via pub use
#[doc(hidden)]
pub mod internal_bindings {
    wit_bindgen::generate!({
        path: "wit/v_0.1.0",
        world: "parse-plugin",
        // Export macro is used withing the exported `parser_export!` macro and must be public
        pub_export_macro: true,
        // Bindings for export macro must be set, because it won't be called from withing the
        // same module where `generate!` is called
        default_bindings_module: "$crate::parser::internal_bindings",
    });
}

// External exports for users
pub use internal_bindings::chipmunk::plugin::{
    parse_types::{Attachment, ParseError, ParseReturn, ParseYield, ParserConfig},
    shared_types::InitError,
};

/// Chipmunk Parser for plugins. This trait must be implemented from types that need to be exported
/// as parser plugin to be used within Chipmunk
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

#[macro_export]
/// TODO AAZ: Macro docs with example
macro_rules! parser_export {
    ($par:ty) => {
        // Make sure Parser trait is in scope
        use $crate::parser::Parser as _ChipmunkDefinedParser;

        static mut PARSER: ::std::option::Option<$par> = ::std::option::Option::None;

        // Name intentionally lengthened to avoid conflict with user's own types
        struct InternalPluginParserGuest;

        impl $crate::parser::internal_bindings::exports::chipmunk::plugin::parser::Guest
            for InternalPluginParserGuest
        {
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
                    $crate::parser::internal_bindings::chipmunk::plugin::host_add::add(
                        item.as_ref(),
                    );
                }
            }
        }

        $crate::parser::internal_bindings::export!(InternalPluginParserGuest);
    };
}

#[cfg(test)]
mod tests {
    use super::*;

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

    parser_export!(Dummy);
}
