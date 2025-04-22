//! Provides types, methods and macros to write plugins that provide producer functionality.

use std::future::Future;

use crate::shared_types::{ConfigItem, ConfigSchemaItem, InitError, Version};

// Module must be public because the generated types and macros are used within `producer_export!`
// macro + macros can't be re-exported via pub use
/// Generated types from producer world in WIT file by the macro [`wit_bindgen::generate`]
/// This is not part of the crate's public API and is subject to change at any time
#[doc(hidden)]
pub mod __internal_bindings {
    wit_bindgen::generate!({
        path: "wit/v0.1.0",
        world: "chipmunk:producer/produce",
        with: {
            "chipmunk:shared/logging@0.1.0": crate::logging,
            "chipmunk:shared/shared-types@0.1.0": crate::shared_types,
            "chipmunk:shared/sandbox@0.1.0": crate::sandbox,
            "chipmunk:parser/parse-types@0.1.0": crate::parser,
        },
        async: {
            exports: [
            "chipmunk:producer/producer@0.1.0#init",
            "chipmunk:producer/producer@0.1.0#produce-next",
            ]
        },
        additional_derives: [Clone],
        // Export macro is used withing the exported `producer_export!` macro and must be public
        pub_export_macro: true,
        // Bindings for export macro must be set, because it won't be called from withing the
        // same module where `generate!` is called
        default_bindings_module: "$crate::producer::__internal_bindings",
    });
}

pub use __internal_bindings::chipmunk::producer::producer_types::{
    ParseYield, ProduceError, ProduceReturn, ProducerConfig,
};

pub use crate::parser::{
    Attachment, ColumnInfo, ColumnsRenderOptions, ParsedMessage, RenderOptions,
};

/// Trait representing a producer for Chipmunk plugins. Types that need to be
/// exported as producer plugins for use within Chipmunk must implement this trait.
pub trait Producer {
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
    /// will be passed to the [`Producer::create()`] method for initializing the producer.
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

    /// Creates an instance of the producer. This method initializes the producer,
    /// configuring it with the provided settings and preparing it to perform reading and
    /// producing.
    ///
    /// # Parameters
    ///
    /// * `general_configs` - General configurations that apply to all producer plugins.
    /// * `plugins_configs` - Plugin-specific configurations, with their schemas provided
    ///   in [`Producer::get_config_schemas()`] method.
    ///
    /// # Returns
    ///
    /// A `Result` containing an instance of the implementing type on success, or an `InitError` on failure.
    fn create(
        general_configs: ProducerConfig,
        plugins_configs: Vec<ConfigItem>,
    ) -> impl Future<Output = Result<Self, InitError>> + 'static
    where
        Self: Sized;

    /// Produces and returns the next available chunk of results from the source.
    ///
    /// This method attempts to read from the underlying data source, process the information,
    /// and returns a collection of successfully produced results. It should be called
    /// repeatedly to consume all available data.
    ///
    /// # Returns
    ///
    /// * `Ok(Vec<ProduceReturn>)` - A vector containing the next batch of produced results.
    /// * `Err(ProduceError)` - A production error occurred, detailed in the `ProduceError`.
    fn produce_next(
        &mut self,
    ) -> impl Future<Output = Result<impl Iterator<Item = ProduceReturn>, ProduceError>>;
}

#[macro_export]
/// Registers the provided type as producer plugin to use within Chipmunk
///
/// The type must implement the [`Producer`] trait.
///
///
/// # Examples
/// ```
/// # use plugins_api::producer::{
/// #     Producer, ProduceReturn, ProduceError, RenderOptions, ProducerConfig
/// # };
/// # use plugins_api::producer_export;
/// # use plugins_api::shared_types::{Version, ConfigSchemaItem, ConfigItem, InitError};
///
///
/// struct MyProducer;
///
/// impl Producer for MyProducer {
///   // ... //
///  #  fn get_version() -> Version {
///  #      todo!()
///  #  }
///  #
///  #  fn get_config_schemas() -> Vec<ConfigSchemaItem> {
///  #      todo!()
///  #  }
///  #
///  #  fn get_render_options() -> RenderOptions {
///  #      todo!()
///  #  }
///  #
///  #  async fn create(
///  #      _general_configs: ProducerConfig,
///  #      _plugins_configs: Vec<ConfigItem>,
///  #  ) -> Result<Self, InitError>
///  #  where
///  #      Self: Sized,
///  #  {
///  #      Ok(MyProducer)
///  #  }
///  #
///  #  async fn produce_next(
///  #      &mut self,
///  #  ) -> Result<impl Iterator<Item = ProduceReturn>, ProduceError> {
///  #      Ok(std::iter::empty())
///  #  }
/// }
///
/// producer_export!(MyProducer);
///
/// ```
macro_rules! producer_export {
    ($par:ty) => {
        // Define producer instance as static field to make it reachable from
        // within `produce_next()` function
        static PRODUCER: ::std::sync::OnceLock<::futures::lock::Mutex<$par>> =
            ::std::sync::OnceLock::new();

        // Define logger as static field to use it with macro initialization
        use $crate::__PluginLogSend;
        use $crate::__PluginLogger;
        static LOGGER: __PluginLogger<__PluginLogSend> = __PluginLogger {
            sender: __PluginLogSend,
        };

        // Name intentionally lengthened to avoid conflict with user's own types
        struct InternalPluginProducerGuest;

        impl $crate::producer::__internal_bindings::exports::chipmunk::producer::producer::Guest
            for InternalPluginProducerGuest
        {
            /// Provides the current semantic version of the plugin.
            /// This version is for the plugin only and is different from the plugin's API version.
            fn get_version() -> $crate::shared_types::Version {
                <$par as $crate::producer::Producer>::get_version()
            }

            /// Provides the schemas for the configurations needed by the plugin to
            /// be specified by the users.
            fn get_config_schemas() -> ::std::vec::Vec<$crate::shared_types::ConfigSchemaItem> {
                <$par as $crate::producer::Producer>::get_config_schemas()
            }

            fn get_render_options() -> $crate::parser::RenderOptions {
                <$par as $crate::producer::Producer>::get_render_options()
            }

            /// Initialize the producer with the given configurations
            async fn init(
                general_configs: $crate::producer::ProducerConfig,
                plugin_configs: ::std::vec::Vec<$crate::shared_types::ConfigItem>,
            ) -> ::std::result::Result<(), $crate::shared_types::InitError> {
                // Logger initialization
                let level = $crate::log::__Level::from(general_configs.log_level);
                $crate::log::__set_logger(&LOGGER)
                    .map(|()| $crate::log::__set_max_level(level.to_level_filter()))
                    .expect("Logger can be set on initialization only");

                // Initializing the given producer
                let producer =
                    <$par as $crate::producer::Producer>::create(general_configs, plugin_configs)
                        .await?;
                let producer_mutex = ::futures::lock::Mutex::new(producer);
                PRODUCER
                    .set(producer_mutex)
                    .expect("Acquiring global producer failed");

                Ok(())
            }

            /// Provide the next chunk of log results when producing success,
            /// otherwise returns the produce error.
            async fn produce_next() -> ::std::result::Result<
                ::std::vec::Vec<$crate::producer::ProduceReturn>,
                $crate::producer::ProduceError,
            > {
                use $crate::parser::{ParseYield, ParsedMessage};
                use $crate::producer::{ProduceReturn, Producer};

                let producer_guard = PRODUCER.get().expect("Acquiring global producer failed");
                let mut producer = producer_guard.lock().await;

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

                producer.produce_next().await.map(|items| {
                    items
                        .map(|mut item| {
                            match &mut item {
                                ProduceReturn::Item(parse_yield) => match parse_yield {
                                    ParseYield::Message(parsed_message)
                                    | ParseYield::MessageAndAttachment((parsed_message, _)) => {
                                        match parsed_message {
                                            ParsedMessage::Line(_) => {}
                                            ParsedMessage::Columns(items) => {
                                                *parsed_message =
                                                    ParsedMessage::Line(items.join(COLUMN_SEP))
                                            }
                                        }
                                    }
                                    ParseYield::Attachment(_) => {}
                                },
                                ProduceReturn::Skipped
                                | ProduceReturn::Incomplete
                                | ProduceReturn::Empty
                                | ProduceReturn::Done => {}
                            };

                            item
                        })
                        .collect()
                })
            }
        }

        // Call the generated export macro from wit-bindgen
        $crate::producer::__internal_bindings::export!(InternalPluginProducerGuest);
    };
}

// This module is used for quick feedback while developing the macro by commenting out the cfg
// attribute. After developing is done the attribute should be put back so this module won't be
// compiled in all real use cases;
#[cfg(test)]
mod prototyping {

    use crate::producer::{ProduceError, ProduceReturn, Producer};

    struct Dummy;

    impl Producer for Dummy {
        fn get_version() -> crate::shared_types::Version {
            todo!()
        }

        fn get_config_schemas() -> Vec<crate::shared_types::ConfigSchemaItem> {
            todo!()
        }

        fn get_render_options() -> crate::producer::RenderOptions {
            todo!()
        }

        async fn create(
            _general_configs: crate::producer::ProducerConfig,
            _plugins_configs: Vec<crate::shared_types::ConfigItem>,
        ) -> Result<Self, crate::shared_types::InitError>
        where
            Self: Sized,
        {
            Ok(Dummy)
        }

        async fn produce_next(
            &mut self,
        ) -> Result<impl Iterator<Item = ProduceReturn>, ProduceError> {
            Ok(std::iter::empty())
        }
    }

    crate::producer_export!(Dummy);
}
