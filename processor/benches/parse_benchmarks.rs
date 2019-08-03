#[macro_use]
extern crate criterion;
extern crate processor;

use processor::parse::*;
use criterion::Criterion;

fn parse_benchmark(c: &mut Criterion) {
    c.bench_function("zero_termitated_string broken input", |b| {
        let input = "05-02-2019 12:36:36.506 0 0.764564113869644 0.7033032911158661 0.807587397462308";
        b.iter(|| detect_timeformat_in_string(input, None))
    });
}

criterion_group!(benches, parse_benchmark);
criterion_main!(benches);
