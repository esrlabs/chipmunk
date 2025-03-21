use std::sync::{Arc, OnceLock};

use wasmtime::{Config, Engine};

/// WASM host for all plugins, containing and managing wasmtime engine.
pub struct WasmHost {
    pub engine: Engine,
}

/// Represents the errors happening while initializing WASM host for all plugins.
#[derive(Debug, thiserror::Error, Clone)]
#[error(transparent)]
// We are using Arc here because the anyhow::Error doesn't implement `Clone` trait
pub struct WasmHostInitError(#[from] Arc<anyhow::Error>);

impl WasmHost {
    fn init() -> Result<Self, WasmHostInitError> {
        let mut config = Config::new();
        config.wasm_component_model(true);
        config.async_support(true);

        let engine = Engine::new(&config).map_err(Arc::new)?;

        let host = Self { engine };

        Ok(host)
    }
}

/// Provide a reference for the [`WasmHost`]
pub fn get_wasm_host() -> Result<&'static WasmHost, &'static WasmHostInitError> {
    static WASM_HOST: OnceLock<Result<WasmHost, WasmHostInitError>> = OnceLock::new();

    WASM_HOST.get_or_init(WasmHost::init).as_ref()
}
