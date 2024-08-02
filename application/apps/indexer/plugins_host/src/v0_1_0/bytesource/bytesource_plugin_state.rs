use wasmtime_wasi::{ResourceTable, WasiCtx, WasiView};

use super::bindings::{
    bytesource_types::{self, Level},
    chipmunk::plugin::logging,
    shared_types,
};

pub struct ByteSourcePluginState {
    pub ctx: WasiCtx,
    pub table: ResourceTable,
}

impl ByteSourcePluginState {
    pub fn new(ctx: WasiCtx, table: ResourceTable) -> Self {
        Self { ctx, table }
    }
}

impl WasiView for ByteSourcePluginState {
    fn table(&mut self) -> &mut ResourceTable {
        &mut self.table
    }

    fn ctx(&mut self) -> &mut WasiCtx {
        &mut self.ctx
    }
}

impl bytesource_types::Host for ByteSourcePluginState {}

impl shared_types::Host for ByteSourcePluginState {}

impl logging::Host for ByteSourcePluginState {
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
