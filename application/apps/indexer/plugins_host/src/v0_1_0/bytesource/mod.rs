mod bindings;
mod bytesource_plugin_state;

use std::io;

use bindings::BytesourcePlugin;
use bytesource_plugin_state::ByteSourcePluginState;
use wasmtime::{
    component::{Component, Linker},
    Store,
};
use wasmtime_wasi::ResourceTable;

use sources::plugins as pl;

use crate::{
    plugins_shared::{get_wasi_ctx_builder, plugin_errors::PluginError},
    semantic_version::SemanticVersion,
    wasm_host::get_wasm_host,
    PluginGuestInitError, PluginHostInitError,
};

pub struct PluginByteSource {
    store: Store<ByteSourcePluginState>,
    plugin_bindings: BytesourcePlugin,
}

impl PluginByteSource {
    pub async fn create(
        component: Component,
        general_config: &pl::PluginByteSourceGeneralSettings,
        plugin_configs: Vec<pl::ConfigItem>,
    ) -> Result<Self, PluginHostInitError> {
        let engine = get_wasm_host()
            .map(|host| &host.engine)
            .map_err(|err| err.to_owned())?;

        let mut linker: Linker<ByteSourcePluginState> = Linker::new(engine);
        wasmtime_wasi::add_to_linker_async(&mut linker)?;

        BytesourcePlugin::add_to_linker(&mut linker, |state| state)?;

        let mut ctx = get_wasi_ctx_builder(&plugin_configs)?;

        let mut store = Store::new(
            engine,
            ByteSourcePluginState::new(ctx.build(), ResourceTable::new()),
        );

        let (plugin_bindings, _instance) =
            BytesourcePlugin::instantiate_async(&mut store, &component, &linker).await?;

        let plugin_configs: Vec<_> = plugin_configs.into_iter().map(|item| item.into()).collect();

        plugin_bindings
            .chipmunk_plugin_byte_source()
            .call_init(&mut store, general_config.into(), &plugin_configs)
            .await?
            .map_err(|guest_err| {
                PluginHostInitError::GuestError(PluginGuestInitError::from(guest_err))
            })?;

        Ok(Self {
            store,
            plugin_bindings,
        })
    }

    pub async fn get_config_schemas(&mut self) -> Result<Vec<pl::ConfigSchemaItem>, PluginError> {
        let schemas = self
            .plugin_bindings
            .chipmunk_plugin_byte_source()
            .call_get_config_schemas(&mut self.store)
            .await?;

        Ok(schemas.into_iter().map(|item| item.into()).collect())
    }

    pub async fn plugin_version(&mut self) -> Result<SemanticVersion, PluginError> {
        let version = self
            .plugin_bindings
            .chipmunk_plugin_byte_source()
            .call_get_version(&mut self.store)
            .await?;

        Ok(version.into())
    }

    pub async fn read_next(&mut self, len: usize) -> io::Result<Vec<u8>> {
        let bytes_result = self
            .plugin_bindings
            .chipmunk_plugin_byte_source()
            .call_read(&mut self.store, len as u64)
            .await
            .map_err(|err| {
                io::Error::new(
                    io::ErrorKind::Other,
                    format!("WASM Error while calling read on bytesource plugin. Error {err}"),
                )
            })?;

        bytes_result.map_err(|err| err.into())
    }
}
