use std::path::PathBuf;

use wasmtime_wasi::{
    ResourceTable,
    p2::{IoView, WasiCtx, WasiView},
};

use crate::plugins_shared::create_plug_temp_dir;

use super::bindings::chipmunk::{
    parser::parse_types,
    shared::{
        logging::{self, Level},
        sandbox, shared_types,
    },
};

/// State to be used within wasmtime runtime store but parser host.
pub struct ParserPluginState {
    pub ctx: WasiCtx,
    pub table: ResourceTable,
    temp_dir: Option<PathBuf>,
}

impl ParserPluginState {
    /// Creates new [`ParserPluginState`] instance from the given arguments.
    pub fn new(ctx: WasiCtx, table: ResourceTable) -> Self {
        Self {
            ctx,
            table,
            temp_dir: None,
        }
    }
}

impl Drop for ParserPluginState {
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

// *** Implementation of traits the must be implemented by parser plugins state ***

impl WasiView for ParserPluginState {
    fn ctx(&mut self) -> &mut WasiCtx {
        &mut self.ctx
    }
}

impl IoView for ParserPluginState {
    fn table(&mut self) -> &mut ResourceTable {
        &mut self.table
    }
}

impl parse_types::Host for ParserPluginState {}

impl shared_types::Host for ParserPluginState {}

impl logging::Host for ParserPluginState {
    /// Log the given message with current log level if log level is allowed
    fn log(&mut self, level: Level, msg: String) {
        const PARSER_LOG_TARGET: &str = "parser_plugin";

        match level {
            Level::Error => log::error!(target: PARSER_LOG_TARGET, "{msg}"),
            Level::Warn => log::warn!(target: PARSER_LOG_TARGET, "{msg}"),
            Level::Info => log::info!(target: PARSER_LOG_TARGET, "{msg}"),
            Level::Debug => log::debug!(target: PARSER_LOG_TARGET, "{msg}"),
            Level::Trace => log::trace!(target: PARSER_LOG_TARGET, "{msg}"),
        }
    }
}

impl sandbox::Host for ParserPluginState {
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
