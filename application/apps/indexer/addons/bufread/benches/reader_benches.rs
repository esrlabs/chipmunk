#![allow(dead_code)]

// Copyright (c) 2025 ESR Labs GmbH. All rights reserved.
//
// NOTICE:  All information contained herein is, and remains
// the property of E.S.R.Labs and its suppliers, if any.
// The intellectual and technical concepts contained herein are
// proprietary to E.S.R.Labs and its suppliers and may be covered
// by German and Foreign Patents, patents in process, and are protected
// by trade secret or copyright law.
// Dissemination of this information or reproduction of this material
// is strictly forbidden unless prior written permission is obtained
// from E.S.R.Labs.

use criterion::{criterion_group, criterion_main, Criterion};
use std::hint::black_box;

#[path = "./bench_config.rs"]
mod bench_config;
use bench_config::bench_config;

#[path = "../tests/proto.rs"]
mod proto;

use bufread::BufReader;
use proto::{Parser, Source, MAX_PACKET_LEN};

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
