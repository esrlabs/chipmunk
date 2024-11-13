//! Benchmarks for producer loop with mock parser and byte source using `jemalloc` memory allocator,
//!
//! The mock of [`parsers::Parser`] will return iterator with multiple value replicating the
//! behavior of the potential plugins in Chipmunk.

mod macros;

mocks_producer_multi!(mocks_multi_producer_jemalloc, tikv_jemallocator::Jemalloc);
