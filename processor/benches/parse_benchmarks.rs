#[macro_use]
extern crate criterion;
extern crate processor;

use processor::parse::*;
use criterion::Criterion;

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
    c.bench_function("detect_timestamp_in_string", move |b| {
        for input in inputs.iter() {
            b.iter(|| detect_timestamp_in_string(input, None))
        }
    });
    c.bench_function("create_timestamp_from_string", move |b| {
        let regex = lookup_regex_for_format_str("DD/MMM/YYYY:hh:mm:ss TZD").unwrap();
        let sample = "109.169.248.247 - - [12/Dec/2015:18:25:11 +0100] GET /administrator";
        b.iter(|| to_posix_timestamp(sample, &regex, None, None))
    });
}

criterion_group!(benches, parse_benchmark);
criterion_main!(benches);
