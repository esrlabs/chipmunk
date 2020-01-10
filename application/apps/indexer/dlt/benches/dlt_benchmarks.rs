#[macro_use]
extern crate criterion;
extern crate dlt;

// use dlt::dlt::*;
use bytes::{BytesMut};
use criterion::Criterion;

fn dlt_benchmark(c: &mut Criterion) {
    c.bench_function("format header", |b| {
        let timestamp = dlt::dlt::DltTimeStamp {
            seconds: 0x4DC9_2C26,
            microseconds: 0x000C_A2D8,
        };
        b.iter(|| format!("{}", timestamp))
    });
    //     c.bench_function("format message", |b| {
    //         let timestamp = DltTimeStamp {
    //             seconds: 0x4DC9_2C26,
    //             microseconds: 0x000C_A2D8,
    //         };
    //         let storage_header = StorageHeader {
    //             timestamp,
    //             ecu_id: "abc".to_string(),
    //         };
    //         let header: StandardHeader = StandardHeader {
    //             version: 1,
    //             has_extended_header: true,
    //             big_endian: true,
    //             message_counter: 0x33,
    //             overall_length: 0x1,
    //             ecu_id: Some("abc".to_string()),
    //             session_id: None,
    //             timestamp: Some(5),
    //         };
    //         let extended_header = dlt::dlt::ExtendedHeader {
    //             argument_count: 2,
    //             verbose: true,
    //             message_type: dlt::dlt::MessageType::Log(LogLevel::Warn),
    //             application_id: "abc".to_string(),
    //             context_id: "CON".to_string(),
    //         };
    //         let type_info = TypeInfo {
    //             kind: TypeInfoKind::Bool,
    //             coding: StringCoding::UTF8,
    //             has_variable_info: true,
    //             has_trace_info: false,
    //         };
    //         let argument = Argument {
    //             type_info,
    //             name: Some("foo".to_string()),
    //             unit: None,
    //             fixed_point: None,
    //             value: Value::Bool(true),
    //         };
    //         let payload = PayloadContent::Verbose(vec![argument]);
    //         let message = Message {
    //             storage_header: Some(storage_header),
    //             header,
    //             extended_header: Some(extended_header),
    //             payload,
    //             fibex_metadata: None,
    //         };
    //         b.iter(|| format!("{}", message))
    //     });
}
fn dlt_parse_benchmark(c: &mut Criterion) {
    c.bench_function("zero_termitated_string broken input", |b| {
        let mut buf = BytesMut::with_capacity(4);
        let broken = vec![0x41, 0, 146, 150];
        buf.extend_from_slice(&broken);
        b.iter(|| dlt::dlt_parse::dlt_zero_terminated_string(&buf, 4))
    });
}

criterion_group!(benches, dlt_benchmark, dlt_parse_benchmark);
criterion_main!(benches);
