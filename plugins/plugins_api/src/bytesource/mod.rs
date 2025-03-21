//! Provides types, methods and macros to write plugins that provide byte source functionality

use crate::shared_types::{ConfigItem, ConfigSchemaItem, InitError, Version};

#[doc(hidden)]
pub mod __internal_bindings {
    wit_bindgen::generate!({
        path: "wit/v0.1.0",
        world: "chipmunk:bytesource/bytesource",
        with: {
            "chipmunk:shared/logging@0.1.0": crate::logging,
            "chipmunk:shared/shared-types@0.1.0": crate::shared_types,
        },
        additional_derives: [Clone],
        // Export macro is used withing the exported `bytesource_export!` macro and must be public
        pub_export_macro: true,
        // Bindings for export macro must be set, because it won't be called from withing the
        // same module where `generate!` is called
        default_bindings_module: "$crate::bytesource::__internal_bindings",
    });
}

// External exports for users
pub use __internal_bindings::chipmunk::bytesource::bytesource_types::{SourceConfig, SourceError};

/// Trait representing a bytesource for Chipmunk plugins. Types that need to be
/// exported as bytesource plugins for use within Chipmunk must implement this trait.
pub trait ByteSource {
    /// Provides the current semantic version of the plugin.
    ///
    /// # Note
    /// This version is for the plugin only and is different from the plugin's API version.
    ///
    /// # Returns
    /// A `Version` object representing the current version of the plugin.
    fn get_version() -> Version;

    /// Provides the schemas for the configurations required by the plugin, which
    /// must be specified by the users.
    ///
    /// These schemas define the expected structure, types, and constraints
    /// for plugin-specific configurations. The values of these configurations
    /// will be passed to the [`ByteSource::create()`] method for initializing the byte source.
    ///
    /// # Returns
    ///
    /// A `Vec` of [`ConfigSchemaItem`] objects, where each item represents
    /// a schema for a specific plugin configuration.
    fn get_config_schemas() -> Vec<ConfigSchemaItem>;

    /// Creates an instance of the bytesource. This method initializes the bytesource,
    /// configuring it with the provided settings and preparing it to provide bytes to Chipmunk.
    ///
    /// # Parameters
    ///
    /// * `general_configs` - General configurations that apply to all bytesource plugins.
    /// * `plugins_configs` - Plugin-specific configurations, with their schemas provided
    ///   in [`ByteSource::get_config_schemas()`] method.
    ///
    /// # Returns
    ///
    /// A `Result` containing an instance of the implementing type on success, or an `InitError` on failure.
    fn create(
        general_configs: SourceConfig,
        plugins_configs: Vec<ConfigItem>,
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
/// # use plugins_api::bytesource::{ByteSource, SourceConfig, SourceError};
/// # use plugins_api::bytesource_export;
/// # use plugins_api::shared_types::{Version, ConfigSchemaItem, ConfigItem, InitError};
///
/// struct CustomByteSoruce;
///
/// impl ByteSource for CustomByteSoruce {
///   // ... //
///  #    fn get_version() -> Version {
///  #        Version::new(0, 1, 0)
///  #    }
///  #    fn get_config_schemas() -> Vec<ConfigSchemaItem> {
///  #        vec![]
///  #    }
///  #
///  #    fn create(
///  #        _general_configs: SourceConfig,
///  #        _plugins_configs: Vec<ConfigItem>,
///  #    ) -> Result<Self, InitError>
///  #    where
///  #        Self: Sized,
///  #    {
///  #        Ok(Self)
///  #    }
///  #
///  #    fn read(&mut self, _len: usize) -> Result<Vec<u8>, SourceError> {
///  #        Ok(vec![])
///  #    }
///  }
///
/// bytesource_export!(CustomByteSoruce);
/// ```
macro_rules! bytesource_export {
    ($par:ty) => {
        // Define bytesource instance as static field to make it reachable from
        // within read function of ByteSource trait
        static BYTESOURCE: std::sync::Mutex<::std::option::Option<$par>> =
            std::sync::Mutex::new(::std::option::Option::None);

        // Define logger as static field to use it with macro initialization
        use $crate::__PluginLogSend;
        use $crate::__PluginLogger;
        static LOGGER: __PluginLogger<__PluginLogSend> = __PluginLogger {
            sender: __PluginLogSend,
        };

        // Name intentionally lengthened to avoid conflict with user's own types
        struct InternalPluginByteSourceGuest;

        impl $crate::bytesource::__internal_bindings::exports::chipmunk::bytesource::byte_source::Guest
            for InternalPluginByteSourceGuest
        {
            /// Provides the current semantic version of the plugin.
            /// This version is for the plugin only and is different from the plugin's API version.
            fn get_version() -> $crate::shared_types::Version {
                <$par as $crate::bytesource::ByteSource>::get_version()
            }
            /// Provides the schemas for the configurations needed by the plugin to
            /// be specified by the users.
            fn get_config_schemas() -> ::std::vec::Vec<$crate::shared_types::ConfigSchemaItem> {
                <$par as $crate::bytesource::ByteSource>::get_config_schemas()
            }

            /// Initialize the bytesource with the given configurations
            fn init(
                general_configs: $crate::bytesource::SourceConfig,
                plugin_configs: ::std::vec::Vec<$crate::shared_types::ConfigItem>,
            ) -> ::std::result::Result<(), $crate::shared_types::InitError> {
                // Logger initialization
                let level = $crate::log::__Level::from(general_configs.log_level);
                $crate::log::__set_logger(&LOGGER)
                    .map(|()| $crate::log::__set_max_level(level.to_level_filter()))
                    .expect("Logger can be set on initialization only");

                // Initializing the given bytesource
                let source = <$par as $crate::bytesource::ByteSource>::create(
                    general_configs,
                    plugin_configs,
                )?;

                *BYTESOURCE.lock().expect("Acquiring global byte-source failed") =
                    ::std::option::Option::Some(source);

                Ok(())
            }

            /// Reads more bytes returning a list of bytes with the given length if possible
            fn read(
                len: u64,
            ) -> ::std::result::Result<::std::vec::Vec<u8>, $crate::bytesource::SourceError> {
                use $crate::bytesource::ByteSource;
                let mut source_guard = BYTESOURCE.lock().expect("Acquiring global byte-source failed");
                let source = source_guard.as_mut().expect("Bytesource already initialized");
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
    struct Dummy;

    impl crate::bytesource::ByteSource for Dummy {
        fn get_version() -> crate::shared_types::Version {
            todo!()
        }

        fn get_config_schemas() -> Vec<crate::shared_types::ConfigSchemaItem> {
            todo!()
        }

        fn create(
            _general_configs: crate::bytesource::SourceConfig,
            _plugins_configs: Vec<crate::shared_types::ConfigItem>,
        ) -> Result<Self, crate::bytesource::InitError>
        where
            Self: Sized,
        {
            todo!()
        }

        fn read(&mut self, _len: usize) -> Result<Vec<u8>, crate::bytesource::SourceError> {
            todo!()
        }
    }

    bytesource_export!(Dummy);
}
