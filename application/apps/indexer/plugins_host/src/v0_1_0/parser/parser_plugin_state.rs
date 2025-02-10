use wasmtime_wasi::{ResourceTable, WasiCtx, WasiView};

use super::bindings::chipmunk::parser::parse_types;
use super::bindings::chipmunk::shared::{
    logging::{self, Level},
    shared_types,
};

/// State to be used within wasmtime runtime store but parser host.
pub struct ParserPluginState {
    pub ctx: WasiCtx,
    pub table: ResourceTable,
}

impl ParserPluginState {
    /// Creates new [`ParserPluginState`] instance from the given arguments.
    pub fn new(ctx: WasiCtx, table: ResourceTable) -> Self {
        Self { ctx, table }
    }
}

// *** Implementation of traits the must be implemented by parser plugins state ***

impl WasiView for ParserPluginState {
    fn table(&mut self) -> &mut ResourceTable {
        &mut self.table
    }

    fn ctx(&mut self) -> &mut WasiCtx {
        &mut self.ctx
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
