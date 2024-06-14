use std::sync::{Arc, OnceLock};

use tokio::sync::OnceCell;
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

        //TODO AAZ: Check the impact of these when we have a proper benchmarks
        // config.relaxed_simd_deterministic(true);
        // config.cranelift_opt_level(wasmtime::OptLevel::Speed);

        let engine = Engine::new(&config).map_err(Arc::new)?;

        let host = Self { engine };

        Ok(host)
    }
}

pub fn get_wasm_host() -> &'static Result<WasmHost, WasmHostInitError> {
    static WASM_HOST: OnceLock<Result<WasmHost, WasmHostInitError>> = OnceLock::new();

    WASM_HOST.get_or_init(WasmHost::init)
}
