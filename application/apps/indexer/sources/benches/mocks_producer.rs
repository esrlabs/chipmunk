use bench_utls::{bench_standrad_config, run_producer};
use criterion::{black_box, criterion_group, criterion_main, BenchmarkId, Criterion};
use mocks::{mock_parser::MockParser, mock_source::MockByteSource};
use sources::producer::MessageProducer;

mod bench_utls;
mod mocks;

/// Runs Benchmarks replicating the producer loop within Chipmunk sessions, using mocks for
/// [`parsers::Parser`] and [`sources::ByteSource`] to ensure that the measurements is for the
/// producer loop only.
///
/// NOTE: This benchmark suffers unfortunately from a lot of noise because we are running it with
/// asynchronous runtime. This test is configured to reduce this amount of noise as possible,
/// However it would be better to run it multiple time for double checking.
fn mocks_producer(c: &mut Criterion) {
    let max_parse_calls = 50000;

    c.bench_with_input(
        BenchmarkId::new("mocks_producer", max_parse_calls),
        &(max_parse_calls),
        |bencher, &max| {
            bencher
                // It's important to spawn a new runtime on each run to ensure to reduce the
                // potential noise produced from one runtime created at the start of all benchmarks
                // only.
                .to_async(tokio::runtime::Runtime::new().unwrap())
                .iter_batched(
                    || {
                        // Exclude initiation time from benchmarks.
                        let parser = MockParser::new(max);
                        let byte_source = MockByteSource::new();
                        let producer = MessageProducer::new(parser, byte_source, black_box(None));

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
    targets = mocks_producer
}

criterion_main!(benches);
