//!Benchmarks for producer loop running multiple times in parallel with mock
//!parser and byte source.
//!
//!The mock of [`parsers::Parser`] will return iterator with multiple value replicating the
//!behavior of the potential plugins in Chipmunk.

use std::hint::black_box;

use criterion::{criterion_group, criterion_main, BenchmarkId, Criterion};

use bench_utls::{bench_standrad_config, run_producer};
use mocks::{mock_parser::MockParser, mock_source::MockByteSource};
use sources::producer::CombinedProducer;

mod bench_utls;
mod mocks;

/// Runs Benchmarks replicating the producer loop within Chipmunk for multiple sessions
/// using mocks for [`parsers::Parser`] and [`sources::ByteSource`] to ensure that the
/// measurements is for the producer loop only.
///
/// The mock of [`parsers::Parser`] will return iterator with multiple value replicating the
/// behavior of the potential plugins in Chipmunk.
///
/// NOTE: This benchmark suffers unfortunately from a lot of noise because we are running it with
/// asynchronous runtime. This test is configured to reduce this amount of noise as possible,
/// However it would be better to run it multiple time for double checking.
fn mocks_multi_parallel(c: &mut Criterion) {
    let max_parse_calls = black_box(10000);
    let tasks_count = black_box(10);
    c.bench_with_input(
        BenchmarkId::new("mocks_multi_parallel", max_parse_calls),
        &(max_parse_calls),
        |bencher, &max| {
            bencher
                .to_async(tokio::runtime::Runtime::new().unwrap())
                .iter_batched(
                    || {
                        let mut producers = Vec::with_capacity(tasks_count);
                        for _ in 0..tasks_count {
                            let parser = MockParser::new_multi(max);
                            let byte_source = MockByteSource::new();
                            let producer = CombinedProducer::new(parser, byte_source);
                            producers.push(producer);
                        }
                        producers
                    },
                    |producers| async {
                        let mut set = tokio::task::JoinSet::new();
                        for producer in producers {
                            set.spawn(run_producer(producer));
                        }
                        while let Some(res) = set.join_next().await {
                            black_box(&res);
                        }
                    },
                    criterion::BatchSize::SmallInput,
                )
        },
    );
}

criterion_group! {
    name = benches;
    config = bench_standrad_config();
    targets = mocks_multi_parallel
}

criterion_main!(benches);
