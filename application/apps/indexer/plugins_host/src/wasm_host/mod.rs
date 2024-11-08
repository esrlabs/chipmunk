use std::sync::{Arc, OnceLock};

use wasmtime::{Config, Engine};

pub struct WasmHost {
    pub engine: Engine,
}

#[derive(Debug, thiserror::Error, Clone)]
#[error(transparent)]
// We are using Arc here because the anyhow::Error doesn't implement `Clone` trait
pub struct WasmHostInitError(#[from] Arc<anyhow::Error>);

impl WasmHost {
    fn init() -> Result<Self, WasmHostInitError> {
        let mut config = Config::new();
        config.wasm_component_model(true);
        config.async_support(true);

        //TODO AAZ: Check the impact

        // Benchmark results:
        // NOTE: Compilation time while loading the plugin isn't part of the parse benchmarks results.
        //
        // #########################
        // ### Parse Performance ###
        // #########################
        // ### With speed: ###
        //   * With Add:
        // plugin_parser_producer  time:   [8.5547 s 8.5811 s 8.6088 s]
        // plugin_parser_producer  time:   [8.6281 s 8.6340 s 8.6409 s]
        // plugin_parser_producer  time:   [8.6167 s 8.6393 s 8.6641 s]
        //
        //  * With list:
        // plugin_parser_producer  time:   [8.9655 s 9.0264 s 9.0855 s]
        //
        //
        // ### Without: ###
        //   * With Add:
        // plugin_parser_producer  time:   [8.7054 s 8.7257 s 8.7566 s]
        // plugin_parser_producer  time:   [8.7059 s 8.7216 s 8.7412 s]
        //
        //   * With list:
        // plugin_parser_producer  time:   [9.0579 s 9.0758 s 9.0898 s]
        // plugin_parser_producer  time:   [9.0844 s 9.0964 s 9.1101 s]
        //
        // **************************************************************************
        //
        //  ########################
        //  ### Load Performance ###
        //  ########################
        //
        // * Without Speed Optimization:
        // -   Loading module took: 616
        // -   Loading module took: 486
        // -   Loading module took: 646
        // -   Loading module took: 533
        //
        // * With speed optimization:
        // - Loading module took: 662
        // - Loading module took: 597
        // - Loading module took: 589
        // - Loading module took: 561
        //
        config.cranelift_opt_level(wasmtime::OptLevel::Speed);

        let engine = Engine::new(&config).map_err(Arc::new)?;

        let host = Self { engine };

        Ok(host)
    }
}

pub fn get_wasm_host() -> Result<&'static WasmHost, &'static WasmHostInitError> {
    static WASM_HOST: OnceLock<Result<WasmHost, WasmHostInitError>> = OnceLock::new();

    WASM_HOST.get_or_init(WasmHost::init).as_ref()
}
