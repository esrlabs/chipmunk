use bindings::Produce;
use parsers::MessageStreamItem;
use producer_plugin_state::ProducerPluginState;
use stypes::{PluginConfigSchemaItem, ProducerRenderOptions, RenderOptions, SemanticVersion};
use wasmtime::{
    component::{Component, Linker},
    Store,
};
use wasmtime_wasi::{ResourceTable, WasiCtx};

use crate::{
    plugins_shared::{get_wasi_ctx_builder, plugin_errors::PluginError, PluginStaticInfo},
    producer_shared::PluginProduceError,
    wasm_host::get_wasm_host,
    PluginGuestError, PluginHostError, PluginParseMessage,
};

mod bindings;
mod producer_plugin_state;

/// Host of the producer plugin for plugins API version 0.1.0
pub struct PluginProducer {
    store: Store<ProducerPluginState>,
    plugin_bindings: Produce,
}

impl PluginProducer {
    /// Load wasm file temporally to retrieve the static plugin information defined by `wit` file
    pub(crate) async fn get_info(component: Component) -> Result<PluginStaticInfo, PluginError> {
        let mut ctx = get_wasi_ctx_builder(&[])?;
        let ctx = ctx.build();

        let mut producer = Self::create(component, ctx).await?;

        let version = producer.plugin_version().await?;

        let render_options = producer.get_render_options().await?;

        let config_schemas = producer.get_config_schemas().await?;

        Ok(PluginStaticInfo {
            version,
            config_schemas,
            render_options: RenderOptions::Producer(Box::new(render_options)),
        })
    }

    /// Creates a new producer instance without initializing it with custom configurations.
    async fn create(component: Component, ctx: WasiCtx) -> Result<Self, PluginHostError> {
        let engine = get_wasm_host()
            .map(|host| &host.engine)
            .map_err(|err| err.to_owned())?;

        let mut linker: Linker<ProducerPluginState> = Linker::new(engine);
        wasmtime_wasi::add_to_linker_async(&mut linker)?;

        Produce::add_to_linker(&mut linker, |state| state)?;

        let resource_table = ResourceTable::new();

        let mut store = Store::new(engine, ProducerPluginState::new(ctx, resource_table));

        let plugin_bindings = Produce::instantiate_async(&mut store, &component, &linker).await?;

        Ok(Self {
            store,
            plugin_bindings,
        })
    }

    /// Initialize producer instance with the needed configuration to be used within a session.
    pub async fn initialize(
        component: Component,
        general_config: &stypes::PluginProducerGeneralSettings,
        plugin_configs: Vec<stypes::PluginConfigItem>,
    ) -> Result<Self, PluginHostError> {
        let mut ctx = get_wasi_ctx_builder(&plugin_configs)?;
        let ctx = ctx.build();

        let mut producer = Self::create(component, ctx).await?;

        let plugin_configs: Vec<_> = plugin_configs.into_iter().map(|item| item.into()).collect();

        producer
            .plugin_bindings
            .chipmunk_producer_producer()
            .call_init(&mut producer.store, general_config.into(), &plugin_configs)
            .await?
            .map_err(|guest_err| PluginHostError::GuestError(PluginGuestError::from(guest_err)))?;

        Ok(producer)
    }

    /// Requests plugins version from plugin Guest.
    pub async fn plugin_version(&mut self) -> Result<SemanticVersion, PluginError> {
        let version = self
            .plugin_bindings
            .chipmunk_producer_producer()
            .call_get_version(&mut self.store)
            .await?;

        Ok(version.into())
    }

    /// Request configuration schemas from the plugin Guest.
    pub async fn get_config_schemas(&mut self) -> Result<Vec<PluginConfigSchemaItem>, PluginError> {
        let schemas = self
            .plugin_bindings
            .chipmunk_producer_producer()
            .call_get_config_schemas(&mut self.store)
            .await?;

        Ok(schemas.into_iter().map(|item| item.into()).collect())
    }

    /// Requests render options from plugin Guest.
    pub async fn get_render_options(&mut self) -> Result<ProducerRenderOptions, PluginError> {
        let options = self
            .plugin_bindings
            .chipmunk_producer_producer()
            .call_get_render_options(&mut self.store)
            .await?;

        Ok(options.into())
    }

    /// Requests plugin guest to produce the next chunk of items filling them in the provided buffer.
    pub async fn produce_next(
        &mut self,
        buffer: &mut Vec<(usize, MessageStreamItem<PluginParseMessage>)>,
    ) -> Result<(), PluginProduceError> {
        const CONSUMED: usize = 0;
        let items_res = self
            .plugin_bindings
            .chipmunk_producer_producer()
            .call_produce_next(&mut self.store)
            .await
            .map_err(|err| {
                PluginProduceError::Unrecoverable(format!(
                    "Communication error with producer plugin: {err}"
                ))
            })?;

        let items = items_res?;

        buffer.extend(items.into_iter().map(|item| (CONSUMED, item.into())));

        Ok(())
    }
}
