use std::path::PathBuf;

use wasmtime_wasi::{IoView, ResourceTable, WasiCtx, WasiView};

/// State to be used within wasmtime runtime store for producer plugins host.
pub struct ProducerPluginState {
    pub ctx: WasiCtx,
    pub table: ResourceTable,
    temp_dir: Option<PathBuf>,
}

impl ProducerPluginState {
    pub fn new(ctx: WasiCtx, table: ResourceTable) -> Self {
        Self {
            ctx,
            table,
            temp_dir: None,
        }
    }
}

//TODO AAZ: This part is shared among all plugins. We need to implement it in one place only.
impl Drop for ProducerPluginState {
    fn drop(&mut self) {
        // Remove temp directory on drop.
        if let Some(tmp_dir) = self.temp_dir.as_ref() {
            if let Err(err) = std::fs::remove_dir_all(tmp_dir) {
                log::error!(
                    "Error while removing plugin temporary directory. Path: {}, err: {err}",
                    tmp_dir.display()
                );
            }
        }
    }
}

// *** Traits implementations ***

impl WasiView for ProducerPluginState {
    fn ctx(&mut self) -> &mut WasiCtx {
        &mut self.ctx
    }
}

impl IoView for ProducerPluginState {
    fn table(&mut self) -> &mut ResourceTable {
        &mut self.table
    }
}
