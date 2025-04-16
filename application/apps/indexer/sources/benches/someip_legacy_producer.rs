mod bench_utls;

use std::{io::Cursor, path::PathBuf};

use bench_utls::{bench_standrad_config, get_config, read_binary, run_producer};
use criterion::{criterion_group, criterion_main, BatchSize, Criterion};
use parsers::someip::SomeipParser;
use sources::{binary::pcap::legacy::PcapLegacyByteSource, producer::CombinedProducer};

/// This benchmark covers parsing from SomeIP file using [`PcapLegacyByteSource`] byte source.
/// It supports providing the path for a fibex file as additional configuration.
fn someip_legacy_producer(c: &mut Criterion) {
    let data = read_binary();

    // Additional configuration are assumed to be one path for a fibex file.
    let fibex_path = get_config().map(|fibex_path| {
        let fibex_path = PathBuf::from(fibex_path);
        assert!(
            fibex_path.exists(),
            "Given fibex metadata file as additional configuration doesn't exist"
        );

        println!("Loading fibex metadata file: {}", fibex_path.display());

        fibex_path
    });

    c.bench_function("someip_legacy_producer", |bencher| {
        bencher
            .to_async(tokio::runtime::Runtime::new().unwrap())
            .iter_batched(
                || {
                    let parser = create_someip_parser(fibex_path.as_ref());
                    let source = PcapLegacyByteSource::new(Cursor::new(data)).unwrap();
                    CombinedProducer::new(parser, source)
                },
                run_producer,
                BatchSize::SmallInput,
            )
    });
}

fn create_someip_parser(config_path: Option<&PathBuf>) -> SomeipParser {
    match config_path {
        Some(p) => SomeipParser::from_fibex_files(vec![p.to_owned()]),
        None => SomeipParser::new(),
    }
}

criterion_group! {
    name = benches;
    config = bench_standrad_config();
    targets = someip_legacy_producer
}

criterion_main!(benches);
