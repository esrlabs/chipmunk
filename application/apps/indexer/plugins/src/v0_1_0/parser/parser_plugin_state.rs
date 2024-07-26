use wasmtime_wasi::{ResourceTable, WasiCtx, WasiView};

use super::bindings::{
    chipmunk::plugin::{
        host_add::Host,
        logging::{self, Level},
        parse_types, shared_types,
    },
    ParseError, ParseReturn,
};

pub struct ParserPluginState {
    pub ctx: WasiCtx,
    pub table: ResourceTable,
    pub results_queue: Vec<Result<ParseReturn, ParseError>>,
}

impl ParserPluginState {
    pub fn new(ctx: WasiCtx, table: ResourceTable) -> Self {
        Self {
            ctx,
            table,
            results_queue: Default::default(),
        }
    }
}

impl WasiView for ParserPluginState {
    fn table(&mut self) -> &mut ResourceTable {
        &mut self.table
    }

    fn ctx(&mut self) -> &mut WasiCtx {
        &mut self.ctx
    }
}

impl Host for ParserPluginState {
    // Add parse results one by one directly at the host memory
    fn add(&mut self, item: Result<ParseReturn, ParseError>) {
        self.results_queue.push(item);
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
