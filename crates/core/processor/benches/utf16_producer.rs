use criterion::{BatchSize, Criterion, criterion_group, criterion_main};

use bench_utls::{bench_standrad_config, create_binary_bytesource, read_binary, run_producer};
use parsers::text::{TextEncoding, TextFormat, Utf16Tokenizer};
use processor::producer::MessageProducer;

mod bench_utls;

/// This benchmark covers parsing UTF-16 text from a file using [`BinaryByteSource`].
/// The byte order is taken from the given input, with or without a byte order mark.
/// This benchmark doesn't support any additional configurations.
///
/// # Panic:
///
/// This function panics if the given input isn't recognized as UTF-16 text. Note that the
/// detection of unmarked input has limits, which the documentation of [`TextFormat::sniff`]
/// describes.
fn utf16_producer(c: &mut Criterion) {
    let data = read_binary();

    let format = TextFormat::sniff(data);
    let TextEncoding::Utf16(endianness) = format.encoding else {
        panic!("Given input isn't recognized as UTF-16 text");
    };

    println!("Input byte order: {endianness:?}");

    // A session consumes the byte order mark before it hands the input to a tokenizer, which
    // doesn't expect to see one.
    let data = &data[format.bom_len..];

    c.bench_function("utf16_producer", |bencher| {
        bencher
            .to_async(tokio::runtime::Runtime::new().unwrap())
            .iter_batched(
                || {
                    let parser = Utf16Tokenizer::new(endianness);
                    let source = create_binary_bytesource(data);
                    MessageProducer::new(parser, source)
                },
                run_producer,
                BatchSize::SmallInput,
            )
    });
}

criterion_group! {
    name = benches;
    config = bench_standrad_config();
    targets = utf16_producer
}

criterion_main!(benches);
