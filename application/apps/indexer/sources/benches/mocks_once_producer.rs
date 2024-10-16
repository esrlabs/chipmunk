//! Benchmarks for producer loop with mock parser and byte source using `mimalloc` memory allocator,
//! which provides the best performance and is used in Chipmunk app currently.
//!
//! The mock of [`parsers::Parser`] will return [`std::iter::once()`] replicating the behavior of
//! the current built-in parsers in Chipmunk.

mod macros;

mocks_producer_once!(mocks_once_producer, mimalloc::MiMalloc);
