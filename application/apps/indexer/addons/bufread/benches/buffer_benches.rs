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

use bufread::DeqBuffer;

fn write_buffer(buffer: &mut DeqBuffer, src: &[u8]) {
    while buffer.write_available() >= src.len() {
        buffer.write_from(src);
    }
}

fn write_buffer_benchmark(c: &mut Criterion) {
    let mut buffer = DeqBuffer::new(50 * 1000);
    let src: [u8; 100] = [1; 100];

    c.bench_function("write_buffer", |b| {
        b.iter(|| write_buffer(black_box(&mut buffer), black_box(&src)))
    });
}

fn write_read_buffer(buffer: &mut DeqBuffer, src: &[u8], dst: &mut [u8]) {
    while buffer.write_available() >= src.len() {
        buffer.write_from(src);
    }
    while buffer.read_available() != 0 {
        buffer.read_to(dst);
    }
}

fn write_read_buffer_benchmark(c: &mut Criterion) {
    let mut buffer = DeqBuffer::new(50 * 1000);
    let src: [u8; 100] = [1; 100];
    let mut dst: [u8; 100] = [1; 100];

    c.bench_function("write_read_buffer", |b| {
        b.iter(|| write_read_buffer(black_box(&mut buffer), black_box(&src), black_box(&mut dst)))
    });
}

criterion_group! {
    name = benches;
    config = bench_config(1000);
    targets = write_buffer_benchmark, write_read_buffer_benchmark
}

criterion_main!(benches);
