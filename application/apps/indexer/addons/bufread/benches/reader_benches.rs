#![allow(dead_code)]

use criterion::{Criterion, criterion_group, criterion_main};
use std::hint::black_box;

#[path = "./bench_config.rs"]
mod bench_config;
use bench_config::bench_config;

#[path = "../tests/proto.rs"]
mod proto;

use bufread::BufReader;
use proto::{MAX_PACKET_LEN, Parser, Source};

fn proto_benchmark(c: &mut Criterion) {
    let source_min_size = 100 * MAX_PACKET_LEN;
    let buffer_max_size = 3 * MAX_PACKET_LEN;
    let buffer_min_size = MAX_PACKET_LEN;

    let source = Source::fixed(source_min_size);
    let reader = BufReader::new(buffer_max_size, buffer_min_size, source.data());
    let mut parser = Parser::new(reader);

    c.bench_function("proto", |b| b.iter(|| Parser::run(black_box(&mut parser))));
}

criterion_group! {
    name = benches;
    config = bench_config(1000);
    targets = proto_benchmark
}

criterion_main!(benches);
