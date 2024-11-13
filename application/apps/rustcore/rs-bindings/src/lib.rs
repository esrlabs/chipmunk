mod js;
mod logging;

// ****************************************
// *** Memory Allocators Configurations ***
// ****************************************

// NOTE: In a Rust project, the memory allocator can only be set once,
// and it applies to the entire project, including all dependencies.
// We chose to configure the allocator in the highest-level library where the runtime is also set.

// Using the mimalloc allocator resulted in an 20% performance improvement on windows
// But there are report of memory leaks and big difference in memory consumption using it.
#[cfg(all(feature = "custom-alloc", windows))]
#[global_allocator]
static GLOBAL: mimalloc::MiMalloc = mimalloc::MiMalloc;

// Jemalloc currently supports UNIX based operating systems only and provides better performance.
#[cfg(all(feature = "custom-alloc", unix))]
#[global_allocator]
static GLOBAL: tikv_jemallocator::Jemalloc = tikv_jemallocator::Jemalloc;
