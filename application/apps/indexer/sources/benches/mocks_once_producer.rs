use std::hint::black_box;

use bench_utls::{bench_standrad_config, run_producer};
use criterion::{criterion_group, criterion_main, Criterion};
use mocks::{mock_parser::MockParser, mock_source::MockByteSource};
use sources::producer::MessageProducer;

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
    c.bench_function("mocks_once_producer", |bencher| {
        bencher
            // It's important to spawn a new runtime on each run to ensure to reduce the
            // potential noise produced from one runtime created at the start of all benchmarks
            // only.
            .to_async(tokio::runtime::Runtime::new().unwrap())
            .iter_batched(
                || {
                    // Exclude initiation time from benchmarks.
                    let max_parse_calls = black_box(50000);
                    let parser = MockParser::new_once(max_parse_calls);
                    let byte_source = MockByteSource::new();
                    let producer = MessageProducer::new(parser, byte_source, black_box(None));

                    producer
                },
                |producer| run_producer(producer),
                criterion::BatchSize::SmallInput,
            )
    });
}

criterion_group! {
    name = benches;
    config = bench_standrad_config();
    targets = mocks_once_producer
}

criterion_main!(benches);
