mod bench_utls;

use criterion::{Criterion, *};

use bench_utls::{create_binary_bytesource, get_config, read_binary, run_producer};
use parsers::dlt::DltParser;
use sources::producer::MessageProducer;

fn dlt_benchmark(c: &mut Criterion) {
    let data = read_binary();
    println!("Data len: {}", data.len());
    let config = get_config();
    dbg!(&config);

    c.bench_function("dlt_producer", |bencher| {
        bencher
            .to_async(tokio::runtime::Runtime::new().unwrap())
            .iter_batched(
                || {
                    let parser = create_dlt_parser(config.as_deref());
                    let source = create_binary_bytesource(data);
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

fn create_dlt_parser<'a>(config: Option<&str>) -> DltParser<'a> {
    //TODO: Consider Configurations
    let _ = config;
    DltParser::new(None, None, None, None, false)
}

//TODO: This is needed to be configured similar to benchmarking with mocking PR.
criterion_group!(benches, dlt_benchmark);

criterion_main!(benches);
