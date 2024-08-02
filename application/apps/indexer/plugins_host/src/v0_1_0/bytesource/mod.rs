mod bindings;
mod bytesource_plugin_state;

use std::{io, path::Path, sync::Mutex};

use bindings::BytesourcePlugin;
use bytesource_plugin_state::ByteSourcePluginState;
use sources::plugins::{ByteSourceInput, PluginByteSourceGeneralSettings};
use wasmtime::{
    component::{Component, Linker},
    Store,
};
use wasmtime_wasi::{DirPerms, FilePerms, ResourceTable};

use crate::{
    plugins_shared::get_wasi_ctx_builder, wasm_host::get_wasm_host, PluginGuestInitError,
    PluginHostInitError, PluginType, WasmPlugin,
};

//TODO AAZ: Remove after prototyping
#[allow(unused)]
pub struct PluginByteSource {
    //TODO AAZ: Check if there is a way to remove the mutex here
    store: Mutex<Store<ByteSourcePluginState>>,
    plugin_bindings: BytesourcePlugin,
}

impl WasmPlugin for PluginByteSource {
    fn get_type() -> PluginType {
        PluginType::ByteSource
    }
}

impl PluginByteSource {
    pub async fn create(
        component: Component,
        input: ByteSourceInput,
        general_config: &PluginByteSourceGeneralSettings,
        config_path: Option<impl AsRef<Path>>,
    ) -> Result<Self, PluginHostInitError> {
        let engine = get_wasm_host()
            .map(|host| &host.engine)
            .map_err(|err| err.to_owned())?;

        let mut linker: Linker<ByteSourcePluginState> = Linker::new(engine);
        wasmtime_wasi::add_to_linker_async(&mut linker)?;

        BytesourcePlugin::add_to_linker(&mut linker, |state| state)?;

        let mut ctx = get_wasi_ctx_builder(config_path.as_ref())?;

        // Additional access privileges for ctx depending on input type.
        match &input {
            ByteSourceInput::File(file_path) => {
                let file_dir = file_path.parent().ok_or(PluginHostInitError::IO(
                    "Resolve input file parent failed".into(),
                ))?;
                ctx.preopened_dir(
                    file_dir,
                    file_dir.to_string_lossy(),
                    DirPerms::READ,
                    FilePerms::READ,
                )?;
            }
            ByteSourceInput::Socket { ip: _, port: _ }
            | ByteSourceInput::Url(_)
            //TODO: Plugins could need access to file system in local database case
            | ByteSourceInput::DbConnectionString(_)
            | ByteSourceInput::Memory(_)
            | ByteSourceInput::Other(_) => {
                // All sources except files could need access to host network
                ctx.inherit_network();
            }
        }

        let mut store = Store::new(
            engine,
            ByteSourcePluginState::new(ctx.build(), ResourceTable::new()),
        );

        let (plugin_bindings, _instance) =
            BytesourcePlugin::instantiate_async(&mut store, &component, &linker).await?;

        let config_path = config_path.map(|path| path.as_ref().to_string_lossy().to_string());

        plugin_bindings
            .chipmunk_plugin_byte_source()
            .call_init(
                &mut store,
                &input.into(),
                general_config.into(),
                config_path.as_deref(),
            )
            .await?
            .map_err(|guest_err| {
                PluginHostInitError::GuestError(PluginGuestInitError::from(guest_err))
            })?;

        let store = Mutex::new(store);

        Ok(Self {
            store,
            plugin_bindings,
        })
    }

    pub async fn read_next(&mut self, len: usize) -> io::Result<Vec<u8>> {
        let store = self.store.get_mut().map_err(|err| {
            io::Error::new(
                io::ErrorKind::Other,
                format!("Bytesource Plugin: Poison Error while acquiring WASM store. Error: {err}"),
            )
        })?;

        let bytes_result = self
            .plugin_bindings
            .chipmunk_plugin_byte_source()
            .call_read(store, len as u64)
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
