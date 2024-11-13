//!Benchmarks for producer loop running multiple times in parallel with mock
//!parser and byte source using rust standard memory allocator.
//!
//!The mock of [`parsers::Parser`] will return iterator with multiple value replicating the
//!behavior of the potential plugins in Chipmunk.

mod macros;

mocks_producer_multi_parallel!(mocks_multi_parallel, std::alloc::System);
