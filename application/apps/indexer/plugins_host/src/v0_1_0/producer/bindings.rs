use parsers::MessageStreamItem;
use stypes::ProducerRenderOptions;

use crate::{producer_shared::PluginProduceError, PluginParseMessage};

pub use self::chipmunk::producer::producer_types::*;

wasmtime::component::bindgen!({
    path: "../../../../plugins/plugins_api/wit/v0.1.0",
    world: "chipmunk:producer/produce",
    additional_derives: [Clone],
    async: {
        only_imports: [],
    },
    with: {
        "chipmunk:shared/logging@0.1.0": crate::v0_1_0::shared::logging,
        "chipmunk:shared/shared-types@0.1.0": crate::v0_1_0::shared::shared_types,
        "chipmunk:shared/sandbox@0.1.0": crate::v0_1_0::shared::sandbox,
        "chipmunk:parser/parse-types@0.1.0": crate::v0_1_0::parser::bindings,
    }
});

impl From<&stypes::PluginProducerGeneralSettings> for ProducerConfig {
    fn from(_value: &stypes::PluginProducerGeneralSettings) -> Self {
        //TODO AAZ: This part is used with all plugins. Check if we can make it central.
        // We must use the current log level form chipmunk because we are using the same log
        // functionality to log the message from the plugins.
        let current_log_level = log::max_level().to_level().unwrap_or(log::Level::Error);

        use crate::v0_1_0::shared::logging::Level as PlugLevel;
        let level = match current_log_level {
            log::Level::Error => PlugLevel::Error,
            log::Level::Warn => PlugLevel::Warn,
            log::Level::Info => PlugLevel::Info,
            log::Level::Debug => PlugLevel::Debug,
            log::Level::Trace => PlugLevel::Trace,
        };

        Self { log_level: level }
    }
}

impl From<ProduceReturn> for MessageStreamItem<PluginParseMessage> {
    fn from(value: ProduceReturn) -> Self {
        match value {
            ProduceReturn::Item(parse_yield) => MessageStreamItem::Item(parse_yield.into()),
            ProduceReturn::Skipped => MessageStreamItem::Skipped,
            ProduceReturn::Incomplete => MessageStreamItem::Incomplete,
            ProduceReturn::Empty => MessageStreamItem::Empty,
            ProduceReturn::Done => MessageStreamItem::Done,
        }
    }
}

impl From<ProduceError> for PluginProduceError {
    fn from(value: ProduceError) -> Self {
        match value {
            ProduceError::Unrecoverable(msg) => PluginProduceError::Unrecoverable(msg),
            ProduceError::Produce(msg) => PluginProduceError::Produce(msg),
            ProduceError::Other(msg) => PluginProduceError::Other(msg),
        }
    }
}

impl From<RenderOptions> for ProducerRenderOptions {
    fn from(value: RenderOptions) -> Self {
        Self {
            columns_options: value.columns_options.map(|o| o.into()),
        }
    }
}
