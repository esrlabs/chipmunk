use std::path::PathBuf;

use wasmtime_wasi::{IoView, ResourceTable, WasiCtx, WasiView};

use crate::plugins_shared::create_plug_temp_dir;

use super::bindings::{
    chipmunk::{
        parser::parse_types,
        producer::producer_types,
        shared::{logging, sandbox, shared_types},
    },
    Level,
};

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

impl producer_types::Host for ProducerPluginState {}

impl shared_types::Host for ProducerPluginState {}

impl parse_types::Host for ProducerPluginState {}

//TODO AAZ: Repeated Code for logging and sandbox
impl logging::Host for ProducerPluginState {
    fn log(&mut self, level: Level, msg: String) {
        const PRODUCER_LOG_TARGET: &str = "producer_plugin";

        match level {
            Level::Error => log::error!(target: PRODUCER_LOG_TARGET, "{msg}"),
            Level::Warn => log::warn!(target: PRODUCER_LOG_TARGET, "{msg}"),
            Level::Info => log::info!(target: PRODUCER_LOG_TARGET, "{msg}"),
            Level::Debug => log::debug!(target: PRODUCER_LOG_TARGET, "{msg}"),
            Level::Trace => log::trace!(target: PRODUCER_LOG_TARGET, "{msg}"),
        }
    }
}

impl sandbox::Host for ProducerPluginState {
    fn temp_directory(&mut self) -> Result<String, String> {
        if let Some(tmp_path) = self.temp_dir.as_ref() {
            return Ok(tmp_path.to_string_lossy().to_string());
        }

        let temp_dir = create_plug_temp_dir().map_err(|err| err.to_string())?;
        let path_as_string = temp_dir.to_string_lossy().to_string();

        self.temp_dir = Some(temp_dir);

        Ok(path_as_string)
    }
}
