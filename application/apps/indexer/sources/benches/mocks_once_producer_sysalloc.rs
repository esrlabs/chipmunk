//! Benchmarks for producer loop with mock parser and byte source using rust standard memory allocator.
//!
//! The mock of [`parsers::Parser`] will return [`std::iter::once()`] replicating the behavior of
//! the current built-in parsers in Chipmunk.

mod macros;

mocks_producer_once!(mocks_once_producer_sysalloc, std::alloc::System);
