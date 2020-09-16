extern crate criterion;
extern crate processor;

use criterion::{measurement::WallTime, Criterion, *};
use processor::parse::*;

fn parse_benchmark(c: &mut Criterion) {
    let inputs = [
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
    c.bench_function("detect_timeformat_in_string", move |b| {
        for input in inputs.iter() {
            b.iter(|| detect_timeformat_in_string(input, None))
        }
    });
    c.bench_function("detect_timestamp_in_string multiple inputs", move |b| {
        for input in inputs.iter() {
            b.iter(|| detect_timestamp_in_string(input, None))
        }
    });
    c.bench_function("create_timestamp_from_string", move |b| {
        let regex = lookup_regex_for_format_str("DD/MMM/YYYY:hh:mm:ss TZD").unwrap();
        let samples = [
            "109.169.248.247 - - [12/Dec/2015:18:25:11 +0100] GET /administrator",
            "109.169.248.247 - - no match here, not in the whole line 12/Dec/2015 is not enough",
            "31.202.233.212 - - [12/Dec/2015:18:46:21 +0100] GET /administrator",
        ];
        let replacements: DateTimeReplacements = DateTimeReplacements {
            day: None,
            month: None,
            year: None,
            offset: None,
        };
        for sample in samples.iter() {
            b.iter(|| extract_posix_timestamp(sample, &regex, replacements.clone()))
        }
    });
    c.bench_function("parse_full_timestamp", move |b| {
        let regex = lookup_regex_for_format_str("DD/MMM/YYYY:hh:mm:ss TZD").unwrap();
        let samples = [
            "109.169.248.247 - - [12/Dec/2015:18:25:11 +0100] GET /administrator",
            "109.169.248.247 - - no match here, not in the whole line 12/Dec/2015 is not enough",
            "31.202.233.212 - - [12/Dec/2015:18:46:21 +0100] GET /administrator",
        ];
        for sample in samples.iter() {
            b.iter(|| parse_full_timestamp(sample, &regex))
        }
    });
    // c.bench(
    //     let regex = lookup_regex_for_format_str("DD/MMM/YYYY:hh:mm:ss TZD").unwrap();

    //     "parse timestamps",
    //     ParameterizedBenchmark::new(
    //         "Recursive",
    //         |b, i| b.iter(|| detect_timeformat_in_string(&regex, *i)),
    //         samples,
    //     )
    //     .with_function("Iterative", |b, i| b.iter(|| parse_full_timestamp(&regex, *i))),
    // );
    let samples = [
        "109.169.248.247 - - [12/Dec/2015:18:25:11 +0100] GET /administrator",
        "109.169.248.247 - - no match here, not in the whole line 12/Dec/2015 is not enough",
        "31.202.233.212 - - [12/Dec/2015:18:46:21 +0100] GET /administrator",
    ];
    let ts_regex = lookup_regex_for_format_str("DD/MMM/YYYY:hh:mm:ss TZD").unwrap();

    // c.bench_function("detect_timestamp_in_string", f: F)
    Benchmark::<WallTime>::new("detect_timestamp_in_string", move |b| {
        for sample in samples.iter() {
            b.iter(|| detect_timestamp_in_string(sample, None))
        }
    })
    .with_function("parse_full_timestamp", move |b| {
        for sample in samples.iter() {
            b.iter(|| parse_full_timestamp(sample, &ts_regex))
        }
    });
}

criterion_group!(benches, parse_benchmark);
criterion_main!(benches);
