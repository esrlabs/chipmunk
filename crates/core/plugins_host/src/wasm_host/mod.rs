use std::sync::{Arc, OnceLock};

use wasmtime::{Config, Engine, OptLevel, RegallocAlgorithm, Strategy};

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

        // Enabling consume fuel provide extra overhead to make the executing code in WASM yield
        // periodically. This may be useful in situations where we expect the code on the plugins
        // to run for long times while the function calls are running in multi task environment.
        //
        // We can leave this config off (Default value) because our current use-cases don't include
        // having heavy calls on plugins while we are multiple tasks in parallel:
        //   * Initialize calls aren't parallel.
        //   * Parse call is blocking call in core.
        config.consume_fuel(false);

        // This is lighter alternative to `consume_fuel` because it will use the counter in WASM
        // engine for epochs (Periods of times). It's possible to set a deadline for epochs on
        // plugin calls and configure to yield, trap or run a callback on deadline exceeded.
        //
        // This is useful in scenarios where untrusted code isn't allowed to block the running
        // task. However, this is not needed in Chipmunk because the calls are running on separate
        // tasks. Value is kept as default.
        config.epoch_interruption(false);

        // This enables new component model intrinsics, and provides extensions to the already
        // enabled wasm_threads feature.
        // Value is different than the defaults.
        config.wasm_shared_everything_threads(true);

        // SIMD optimization in WASM. Enabled as in default.
        config.wasm_simd(true);
        config.wasm_relaxed_simd(true);
        // Don't force deterministic SIMD behavior on all architectures, giving each platform
        // to benefits from all available SIMD optimizations. Value kept as default.
        config.relaxed_simd_deterministic(false);

        // Strategy::Auto is set currently to Cranelift.
        config.strategy(Strategy::Auto);

        // Optimize the code for speed. Values kept as default.
        config.cranelift_opt_level(OptLevel::Speed);
        config.cranelift_regalloc_algorithm(RegallocAlgorithm::Backtracking);

        // Benchmarked has shown that the default memory reservation 4GiB is enough. Extending it
        // up to 16 GiB didn't bring any performance improvements.
        // config.memory_reservation(4 * 1024 * 1024 * 1024);
        //
        // Also here the default value of 4 MiB is enough to get the best performance.
        // config.memory_guard_size(4 * 1024 * 1024);

        // Indicate that plugins are allowed to get more memory if the `memory_reservation` is
        // full. This can be disabled to prevent plugins from requesting too much memory, causing
        // the system to crash.
        // However, disabling it indicates that we must provide sensible values for
        // memory_reservation since memory can't grow anymore.
        // Value kept as default.
        config.memory_may_move(true);

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
