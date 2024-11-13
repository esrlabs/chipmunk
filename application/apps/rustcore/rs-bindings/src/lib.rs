mod js;
mod logging;

// Using the mimalloc allocator resulted in an 20% performance improvement on windows.
// NOTE: In a Rust project, the memory allocator can only be set once,
// and it applies to the entire project, including all dependencies.
// We chose to configure the allocator in the highest-level library where the runtime is also set.
#[cfg(windows)]
#[global_allocator]
static GLOBAL: mimalloc::MiMalloc = mimalloc::MiMalloc;
