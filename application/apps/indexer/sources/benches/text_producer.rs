mod bench_utls;

use criterion::{Criterion, *};

use bench_utls::{create_binary_bytesource, read_binary, run_producer};
use parsers::text::StringTokenizer;
use sources::producer::MessageProducer;

fn text_benchmark(c: &mut Criterion) {
    let data = read_binary();
    println!("Data len: {}", data.len());

    c.bench_function("text_producer", |bencher| {
        bencher
            .to_async(tokio::runtime::Runtime::new().unwrap())
            .iter_batched(
                || {
                    let parser = StringTokenizer {};
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

//TODO: This is needed to be configured similar to benchmarking with mocking PR.
criterion_group!(benches, text_benchmark);

criterion_main!(benches);
