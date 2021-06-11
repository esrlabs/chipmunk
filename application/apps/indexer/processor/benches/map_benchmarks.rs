extern crate criterion;
extern crate processor;

use criterion::{Criterion, *};
use processor::map::{FilterMatch, SearchMap};

fn scaled_benchmark(c: &mut Criterion) {
    let mut example_map: SearchMap = SearchMap::new();
    let mut v = vec![];
    for i in (1..1_000_000).step_by(50) {
        v.push(FilterMatch::new(i, vec![0]));
        v.push(FilterMatch::new(i + 22, vec![0, 1]));
    }
    example_map.set(Some(v));

    c.bench_function("calculate_scaled_map", move |b| {
        for input in [
            20, 50, 100, 200, 250, 400, 500, 600, 800, 1024, 1200, 1500, 1800, 2700,
        ] {
            b.iter(|| example_map.scaled(input, None))
        }
    });
}

criterion_group!(benches, scaled_benchmark,);
criterion_main!(benches);
