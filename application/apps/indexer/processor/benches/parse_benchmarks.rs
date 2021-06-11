extern crate criterion;
extern crate processor;

use criterion::{Criterion, *};
use processor::parse::*;

const LOG_LINE_SAMPLES: [&str; 3] = [
    "109.169.248.247 - - [12/Dec/2015:18:25:11 +0100] GET /administrator",
    "109.169.248.247 - - no match here, not in the whole line 12/Dec/2015 is not enough",
    "31.202.233.212 - - [12/Dec/2015:18:46:21 +0100] GET /administrator",
];

const TIMESTAMP_INPUTS: [&str; 10] = [
    "2019-05-02 00:06:26.506 abc",
    "2019-05-02T01:36:36.506 abc",
    "05-02 23:46:46.506 abc",
    "05-02T12:56:56.506 abc",
    "05-02-2019 12:16:06.506 abc",
    "05-02-2019T12:26:36.506 abc",
    "02/May/2019:12:36:36 abc",
    "02/May/2019T12:36:36 abc",
    "some stuff before: 05-02-2019T12:36:36.506 0 0.764564113869644",
    "non matching line 02-02-2019 12_36_379 bllllllllllah",
];

fn timestamp_in_string_multiple_inputs_benchmark(c: &mut Criterion) {
    let mut group = c.benchmark_group("detect");
    for input in TIMESTAMP_INPUTS.iter() {
        group.bench_with_input(BenchmarkId::from_parameter(input), input, |b, &input| {
            b.iter(|| detect_timestamp_in_string(input, None))
        });
    }
    group.finish();
    // for input in TIMESTAMP_INPUTS.iter() {
    //     b.iter(|| detect_timestamp_in_string(input, None))
    // }
    // });
}

fn detect_timeformat_in_string_benchmark(c: &mut Criterion) {
    c.bench_function("detect_timeformat_in_string", move |b| {
        for input in TIMESTAMP_INPUTS.iter() {
            b.iter(|| detect_timeformat_in_string(input, None))
        }
    });
}

fn create_timestamp_from_string_benchmark(c: &mut Criterion) {
    let regex = lookup_regex_for_format_str("DD/MMM/YYYY:hh:mm:ss TZD").unwrap();
    c.bench_function("create_timestamp_from_string", move |b| {
        let replacements: DateTimeReplacements = DateTimeReplacements {
            day: None,
            month: None,
            year: None,
            offset: None,
        };
        for sample in LOG_LINE_SAMPLES.iter() {
            b.iter(|| extract_posix_timestamp(sample, &regex, replacements.clone()))
        }
    });
}

fn timestamp_detection_benchmark(c: &mut Criterion) {
    c.bench_function("detect_timestamp_in_string", move |b| {
        for sample in LOG_LINE_SAMPLES.iter() {
            b.iter(|| detect_timestamp_in_string(black_box(sample), black_box(None)))
        }
    });
}
fn timestamp_parsing_benchmark(c: &mut Criterion) {
    c.bench_function("parse_full_timestamp", move |b| {
        let ts_regex = lookup_regex_for_format_str("DD/MMM/YYYY:hh:mm:ss TZD").unwrap();
        for sample in LOG_LINE_SAMPLES.iter() {
            b.iter(|| parse_full_timestamp(sample, &ts_regex))
        }
    });
}

criterion_group!(
    benches,
    detect_timeformat_in_string_benchmark,
    create_timestamp_from_string_benchmark,
    timestamp_in_string_multiple_inputs_benchmark,
    timestamp_detection_benchmark,
    timestamp_parsing_benchmark
);
criterion_main!(benches);
