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

        //TODO AAZ: Check the impact on the final version

        // Benchmark results:
        // NOTE: Compilation time while loading the plugin isn't part of the parse benchmarks results.
        //
        // #########################
        // ### Parse Performance ###
        // #########################
        // ### With speed: ###
        // [8.9655 s 9.0264 s 9.0855 s]
        //
        // ### Without: ###
        // [9.0579 s 9.0758 s 9.0898 s]
        // [9.0844 s 9.0964 s 9.1101 s]
        //
        // **************************************************************************
        //
        //  ########################
        //  ### Load Performance ###
        //  ########################
        //
        //
        // * Without Speed Optimization:
        // ** Criterion:
        // [224.44 ms 226.30 ms 228.17 ms]
        // [225.31 ms 227.36 ms 229.37 ms]
        // [224.51 ms 226.67 ms 228.92 ms]
        // [224.10 ms 225.80 ms 227.52 ms]
        //
        // ** In App:
        //  616 486 646 533
        //
        // * With speed optimization:
        // ** Criterion:
        // [227.87 ms 229.93 ms 232.01 ms]
        // [226.39 ms 228.11 ms 229.86 ms]
        // [223.97 ms 225.91 ms 227.86 ms]
        // [225.12 ms 227.59 ms 230.30 ms]
        //
        // ** In App:
        //  662 597 589 561

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
