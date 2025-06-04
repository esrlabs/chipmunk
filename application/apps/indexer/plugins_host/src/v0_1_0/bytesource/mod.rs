//! Include structures and implementation of byte-source plugins for API version 0.1.0
//! as defined in WIT files.

mod bindings;
mod bytesource_plugin_state;

use std::io;

use bindings::Bytesource;
use bytesource_plugin_state::ByteSourcePluginState;
use stypes::{RenderOptions, SemanticVersion};
use wasmtime::{
    Store,
    component::{Component, Linker},
};
use wasmtime_wasi::{ResourceTable, p2::WasiCtx};

use crate::{
    PluginGuestError, PluginHostError,
    plugins_shared::{PluginInfo, get_wasi_ctx_builder, plugin_errors::PluginError},
    wasm_host::get_wasm_host,
};

/// Host of the byte-source plugin for plugins API version 0.1.0
pub struct PluginByteSource {
    store: Store<ByteSourcePluginState>,
    plugin_bindings: Bytesource,
}

impl PluginByteSource {
    /// Load wasm file temporally to retrieve the static plugin information defined by `wit` file
    pub(crate) async fn get_info(component: Component) -> Result<PluginInfo, PluginError> {
        let mut ctx = get_wasi_ctx_builder(&[])?;
        let ctx = ctx.build();
        let mut source = Self::create(component, ctx).await?;

        let version = source.plugin_version().await?;

        let render_options = RenderOptions::ByteSource;

        let config_schemas = source.get_config_schemas().await?;

        Ok(PluginInfo {
            version,
            config_schemas,
            render_options,
        })
    }

    /// Creates a new byte-source instance without initializing it with custom configurations.
    async fn create(component: Component, ctx: WasiCtx) -> Result<Self, PluginHostError> {
        let engine = get_wasm_host()
            .map(|host| &host.engine)
            .map_err(|err| err.to_owned())?;

        let mut linker: Linker<ByteSourcePluginState> = Linker::new(engine);
        wasmtime_wasi::p2::add_to_linker_async(&mut linker)?;

        Bytesource::add_to_linker(&mut linker, |state| state)?;

        let resource_table = ResourceTable::new();

        let mut store = Store::new(engine, ByteSourcePluginState::new(ctx, resource_table));

        let plugin_bindings =
            Bytesource::instantiate_async(&mut store, &component, &linker).await?;

        Ok(Self {
            store,
            plugin_bindings,
        })
    }

    /// Initialize byte-source instance with the needed configuration to be used within sessions.
    pub async fn initialize(
        component: Component,
        general_config: &stypes::PluginByteSourceGeneralSettings,
        plugin_configs: Vec<stypes::PluginConfigItem>,
    ) -> Result<Self, PluginHostError> {
        let mut ctx = get_wasi_ctx_builder(&plugin_configs)?;
        let ctx = ctx.build();

        let mut byte_source = Self::create(component, ctx).await?;

        let plugin_configs: Vec<_> = plugin_configs.into_iter().map(|item| item.into()).collect();

        byte_source
            .plugin_bindings
            .chipmunk_bytesource_byte_source()
            .call_init(
                &mut byte_source.store,
                general_config.into(),
                &plugin_configs,
            )
            .await?
            .map_err(|guest_err| PluginHostError::GuestError(PluginGuestError::from(guest_err)))?;

        Ok(byte_source)
    }

    /// Request configuration schemas from the plugin Guest.
    pub async fn get_config_schemas(
        &mut self,
    ) -> Result<Vec<stypes::PluginConfigSchemaItem>, PluginError> {
        let schemas = self
            .plugin_bindings
            .chipmunk_bytesource_byte_source()
            .call_get_config_schemas(&mut self.store)
            .await?;

        Ok(schemas.into_iter().map(|item| item.into()).collect())
    }

    /// Requests plugins version from plugin Guest.
    pub async fn plugin_version(&mut self) -> Result<SemanticVersion, PluginError> {
        let version = self
            .plugin_bindings
            .chipmunk_bytesource_byte_source()
            .call_get_version(&mut self.store)
            .await?;

        Ok(version.into())
    }

    /// Requests from guest plugins to read and provide next chunk for bytes with
    /// the given length.
    pub async fn read_next(&mut self, len: usize) -> io::Result<Vec<u8>> {
        let bytes_result = self
            .plugin_bindings
            .chipmunk_bytesource_byte_source()
            .call_read(&mut self.store, len as u64)
            .await
            .map_err(|err| {
                io::Error::other(
                    // Wasmtime uses anyhow error, which provides error context in debug print only.
                    format!("WASM Error while calling read on bytesource plugin. Error {err:?}"),
                )
            })?;

        bytes_result.map_err(|err| err.into())
    }
}
