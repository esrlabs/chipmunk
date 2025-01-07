use std::hint::black_box;

use criterion::{criterion_group, criterion_main, BatchSize, Criterion};

use bench_utls::{bench_standrad_config, create_binary_bytesource, read_binary, run_producer};
use parsers::text::StringTokenizer;
use sources::producer::MessageProducer;

mod bench_utls;

/// This benchmark covers parsing from text file file using [`BinaryByteSource`].
/// This benchmark doesn't support any additional configurations.
fn text_producer(c: &mut Criterion) {
    let data = read_binary();

    c.bench_function("text_producer", |bencher| {
        bencher
            .to_async(tokio::runtime::Runtime::new().unwrap())
            .iter_batched(
                || {
                    let parser = StringTokenizer {};
                    let source = create_binary_bytesource(data);
                    MessageProducer::new(parser, source, black_box(None))
                },
                run_producer,
                BatchSize::SmallInput,
            )
    });
}

criterion_group! {
    name = benches;
    config = bench_standrad_config();
    targets = text_producer
}

criterion_main!(benches);
