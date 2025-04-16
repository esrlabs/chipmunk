//! Benchmarks for producer loop with mock parser and byte source.
//!
//! The mock of [`parsers::Parser`] will return [`std::iter::once()`] replicating the behavior of
//! the current built-in parsers in Chipmunk.

use bench_utls::{bench_standrad_config, run_producer};
use criterion::{criterion_group, criterion_main, BenchmarkId, Criterion};
use mocks::{mock_parser::MockParser, mock_source::MockByteSource};
use sources::producer::CombinedProducer;
mod bench_utls;
mod mocks;

/// Runs Benchmarks replicating the producer loop within Chipmunk sessions, using mocks for
/// [`parsers::Parser`] and [`sources::ByteSource`] to ensure that the measurements is for the
/// producer loop only.
///
/// The mock of [`parsers::Parser`] will return [`std::iter::once()`] replicating the behavior of
/// the current built-in parsers in Chipmunk.
///
/// NOTE: This benchmark suffers unfortunately from a lot of noise because we are running it with
/// asynchronous runtime. This test is configured to reduce this amount of noise as possible,
/// However it would be better to run it multiple time for double checking.
fn mocks_once_producer(c: &mut Criterion) {
    let max_parse_calls = 50000;
    c.bench_with_input(
        BenchmarkId::new("mocks_once_producer", max_parse_calls),
        &(max_parse_calls),
        |bencher, &max| {
            bencher
                .to_async(tokio::runtime::Runtime::new().unwrap())
                .iter_batched(
                    || {
                        let parser = MockParser::new_once(max);
                        let byte_source = MockByteSource::new();
                        let producer = CombinedProducer::new(parser, byte_source);
                        producer
                    },
                    |producer| run_producer(producer),
                    criterion::BatchSize::SmallInput,
                )
        },
    );
}
criterion_group! {
    name = benches;
    config = bench_standrad_config();
    targets = mocks_once_producer
}
criterion_main!(benches);
