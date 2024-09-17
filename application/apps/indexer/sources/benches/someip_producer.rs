mod bench_utls;

use std::{io::Cursor, path::PathBuf};

use bench_utls::{get_config, read_binary, run_producer};
use criterion::{black_box, criterion_group, criterion_main, BatchSize, Criterion};
use parsers::someip::SomeipParser;
use sources::{binary::pcap::ng::PcapngByteSource, producer::MessageProducer};

fn someip_benchmark(c: &mut Criterion) {
    let data = read_binary();
    println!("Data len: {}", data.len());
    let config_path = match get_config() {
        Some(c) => {
            let config_path = PathBuf::from(c);
            assert!(
                config_path.exists(),
                "Provided configuration path doesn't exist. Path: {}",
                config_path.display()
            );

            Some(config_path)
        }
        None => None,
    };

    dbg!(&config_path);

    c.bench_function("someip_producer", |bencher| {
        bencher
            .to_async(tokio::runtime::Runtime::new().unwrap())
            .iter_batched(
                || {
                    let parser = create_someip_parser(config_path.clone());
                    let source = create_bytesource(data);
                    let producer = MessageProducer::new(parser, source, black_box(None));

                    producer
                },
                |p| run_producer(p),
                // |p| async {
                //     let a = run_producer(p).await;
                //     dbg!(a)
                // },
                BatchSize::SmallInput,
            )
    });
}

fn create_bytesource(data: &'static [u8]) -> PcapngByteSource<Cursor<&'static [u8]>> {
    PcapngByteSource::new(Cursor::new(data)).unwrap()
}

fn create_someip_parser(config_path: Option<PathBuf>) -> SomeipParser {
    match config_path {
        Some(p) => SomeipParser::from_fibex_files(vec![p]),
        None => SomeipParser::new(),
    }
}

//TODO: This is needed to be configured similar to benchmarking with mocking PR.
criterion_group!(benches, someip_benchmark);

criterion_main!(benches);
