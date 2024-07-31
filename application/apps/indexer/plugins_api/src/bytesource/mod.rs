//! Provides types, methods and macros to write plugins that provide byte source functionality

mod logging;

// This is needed to be public because it's used in the export macro
#[doc(hidden)]
pub use logging::ByteSourceLogSend as __ByteSourceLogSend;

#[doc(hidden)]
pub mod __internal_bindings {
    wit_bindgen::generate!({
        path: "wit/v_0.1.0",
        world: "bytesource-plugin",
        // Export macro is used withing the exported `bytesource_export!` macro and must be public
        pub_export_macro: true,
        // Bindings for export macro must be set, because it won't be called from withing the
        // same module where `generate!` is called
        default_bindings_module: "$crate::bytesource::__internal_bindings",
    });
}

use std::path::PathBuf;

// External exports for users
pub use __internal_bindings::chipmunk::plugin::{
    bytesource_types::{SourceConfig, SourceError},
    logging::Level,
    shared_types::InitError,
};

/// Trait representing a bytesource for Chipmunk plugins. Types that need to be
/// exported as bytesource plugins for use within Chipmunk must implement this trait.
pub trait ByteSource {
    /// Creates an instance of the bytesource. This method initializes the bytesource,
    /// configuring it with the provided settings and preparing it to provide bytes to Chipmunk.
    ///
    /// # Parameters
    ///
    /// * `general_configs` - General configurations that apply to all bytesource plugins.
    /// * `config_path` - Optional path to a custom configuration file specific to this plugin.
    ///
    /// # Returns
    ///
    /// A `Result` containing an instance of the implementing type on success, or an `InitError` on failure.
    fn create(
        general_configs: SourceConfig,
        config_path: Option<PathBuf>,
    ) -> Result<Self, InitError>
    where
        Self: Sized;

    /// Reads and returns a specified number of bytes.
    ///
    /// # Parameters
    ///
    /// * `len` - The minimum number of bytes to read. The returned vector's length will be at least this value.
    ///
    /// # Returns
    ///
    /// A `Result` containing a vector of bytes on success, or a `SourceError` on failure.
    fn read(&mut self, len: usize) -> Result<Vec<u8>, SourceError>;
}

#[macro_export]
/// Registers the provided type as bytesource plugin to use within Chipmunk
///
/// The type must implement the [`ByteSource`] trait.
///
/// # Examples
///
/// ```
/// # use plugins_api::bytesource::*;
/// # use plugins_api::*;
/// # use std::path::PathBuf;
///
/// struct CustomByteSoruce;
///
/// impl ByteSource for CustomByteSoruce {
///   // ... //
///  #    fn create(
///  #        _general_configs: SourceConfig,
///  #        _config_path: Option<PathBuf>,
///  #    ) -> Result<Self, InitError>
///  #    where
///  #        Self: Sized,
///  #    {
///  #        Ok(Self)
///  #    }
///  #
///  #    fn read(&mut self, len: usize) -> Result<Vec<u8>, SourceError> { todo!() }
///  }
///
/// bytesource_export!(CustomByteSoruce);
/// ```
macro_rules! bytesource_export {
    ($par:ty) => {
        // Define bytesource instance as static field to make it reachable from
        // within read function of ByteSource trait
        static mut BYTESOURCE: ::std::option::Option<$par> = ::std::option::Option::None;

        // Define logger as static field to use it with macro initialization
        use $crate::__PluginLogger;
        use $crate::bytesource::__ByteSourceLogSend;
        static LOGGER: __PluginLogger<__ByteSourceLogSend> = __PluginLogger {
            sender: __ByteSourceLogSend,
        };

        // Name intentionally lengthened to avoid conflict with user's own types
        struct InternalPluginByteSourceGuest;

        impl $crate::bytesource::__internal_bindings::exports::chipmunk::plugin::byte_source::Guest
            for InternalPluginByteSourceGuest
        {
            /// Initialize the bytesource with the given configurations
            fn init(
                general_configs: $crate::bytesource::SourceConfig,
                plugin_configs: ::std::option::Option<::std::string::String>,
            ) -> ::std::result::Result<(), $crate::bytesource::InitError> {
                // Logger initialization
                let level = $crate::log::Level::from(general_configs.log_level);
                $crate::log::set_logger(&LOGGER)
                    .map(|()| $crate::log::set_max_level(level.to_level_filter()))
                    .expect("Logger can be set on initialization only");

                // Initializing the given bytesource
                let source = <$par as $crate::bytesource::ByteSource>::create(
                    general_configs,
                    plugin_configs.map(|path| path.into()),
                )?;
                // SAFETY: Initializing the bytesource happens once only on the host
                unsafe {
                    BYTESOURCE = ::std::option::Option::Some(source);
                }

                Ok(())
            }

            /// Reads more bytes returning a list of bytes with the given length if possible
            fn read(
                len: u64,
            ) -> ::std::result::Result<::std::vec::Vec<u8>, $crate::bytesource::SourceError> {
                // SAFETY: Bytesource host implements read trait, which takes a mutable reference
                // to self when called. Therefor it's not possible to have multiple references on
                // the static bytesource instance here at once.
                let source =
                    unsafe { BYTESOURCE.as_mut().expect("Bytesource already initialized") };
                source.read(len as usize)
            }
        }

        // Call the generated export macro from wit-bindgen
        $crate::bytesource::__internal_bindings::export!(InternalPluginByteSourceGuest);
    };
}

// This module is used for quick feedback while developing the macro by commenting out the cfg
// attribute. After developing is done the attribute should be put back so this module won't be
// compiled in all real use cases;
#[cfg(test)]
mod prototyping {
    use super::*;

    struct Dummy;

    impl ByteSource for Dummy {
        fn create(
            _general_configs: SourceConfig,
            _config_path: Option<PathBuf>,
        ) -> Result<Self, InitError>
        where
            Self: Sized,
        {
            todo!()
        }

        fn read(&mut self, _len: usize) -> Result<Vec<u8>, SourceError> {
            todo!()
        }
    }

    bytesource_export!(Dummy);
}
