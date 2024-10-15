use criterion::{criterion_group, criterion_main, BatchSize, Criterion};
use std::{hint::black_box, path::PathBuf};

use bench_utls::{
    bench_standrad_config, create_binary_bytesource, get_config, read_binary, run_producer,
};
use parsers::dlt::{self, DltParser};
use sources::producer::MessageProducer;

mod bench_utls;

// The MiMalloc allocator is currently used in the Chipmunk app.
#[global_allocator]
static GLOBAL: mimalloc::MiMalloc = mimalloc::MiMalloc;

/// This benchmark covers parsing from DLT file and supports providing the path for a fibex file as
/// additional configuration.
fn dlt_producer(c: &mut Criterion) {
    let data = read_binary();

    // Additional configuration are assumed to be one path for a fibex file.
    let fibex = get_config().map(|fibex_path| {
        assert!(
            PathBuf::from(&fibex_path).exists(),
            "Given fibex metadata file as additional configuration doesn't exist"
        );

        println!("Loading fibex metadata file: {fibex_path}");

        dlt::gather_fibex_data(dlt::FibexConfig {
            fibex_file_paths: vec![fibex_path],
        })
        .expect("Error while loading fibex metadata")
    });

    c.bench_function("dlt_producer", |bencher| {
        bencher
            .to_async(tokio::runtime::Runtime::new().unwrap())
            .iter_batched(
                || {
                    let parser = DltParser::new(None, fibex.as_ref(), None, None, true);
                    let source = create_binary_bytesource(data);
                    let producer = MessageProducer::new(parser, source, black_box(None));

                    producer
                },
                |p| run_producer(p),
                BatchSize::SmallInput,
            )
    });
}

criterion_group! {
    name = benches;
    config = bench_standrad_config();
    targets = dlt_producer
}

criterion_main!(benches);
