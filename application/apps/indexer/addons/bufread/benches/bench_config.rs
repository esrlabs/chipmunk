use criterion::Criterion;
use std::time::Duration;

pub fn bench_config(sample_size: usize) -> Criterion {
    Criterion::default()
        .warm_up_time(Duration::from_secs(5))
        .measurement_time(Duration::from_secs(10))
        .sample_size(sample_size)
        .significance_level(0.01)
        .noise_threshold(0.05)
}
