use criterion::{criterion_group, criterion_main, BenchmarkId, Criterion};

async fn produce(val: usize, val_2: usize) {
    //TODO AAZ:
    assert_eq!(val, val_2);
}

mod mocks;

fn producer_benchmark(c: &mut Criterion) {
    let val = 1024;

    c.bench_with_input(BenchmarkId::new("producer", val), &val, |bencher, &v| {
        bencher
            .to_async(tokio::runtime::Runtime::new().unwrap())
            .iter(|| produce(v, v));
    });
}

criterion_group!(benches, producer_benchmark);
criterion_main!(benches);
