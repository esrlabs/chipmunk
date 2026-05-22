// Types here are used within benchmarks but rust checking isn't able to connect the module
// together yet.
#![allow(unused)]

use std::{
    alloc::Layout,
    fs::File,
    io::{Cursor, Read},
    path::PathBuf,
    time::Duration,
};

use criterion::Criterion;
use parsers::{LogMessage, ParseYield};
use processor::producer::{GeneralLogCollector, MessageProducer};
use sources::binary::raw::BinaryByteSource;

pub const INPUT_SOURCE_ENV_VAR: &str = "CHIPMUNK_BENCH_SOURCE";
pub const CONFIG_ENV_VAR: &str = "CHIPMUNK_BENCH_CONFIG";
pub const SAMPLE_SIZE_ENV_VAR: &str = "CHIPMUNK_BENCH_SAMPLE_SIZE";

/// Retrieves the path of the binary files from the environment variable [`INPUT_SOURCE_ENV_VAR`]
/// then reads it providing its content as bytes.
///
/// # Panic:
///
/// This function panics if the environment variables isn't set, file with the path doesn't exist
/// or can't be read.
pub fn read_binary() -> &'static [u8] {
    let input_file = match std::env::var(INPUT_SOURCE_ENV_VAR) {
        Ok(input) =>PathBuf::from(input),
        Err(err) => panic!("Error while retrieving input file.\n
Please ensure to provide the path of input file for benchmarks via command line arguments if you are using chipmunk build cli tool\
or via the environment variable: '{INPUT_SOURCE_ENV_VAR}' if you are running the benchmark directly.\n Error Info: {err}"),
    };

    assert!(
        input_file.exists(),
        "Given input file doesn't exist. Path: {}",
        input_file.display()
    );

    let mut binary = Vec::new();

    let mut file = File::open(&input_file).unwrap();
    file.read_to_end(&mut binary).unwrap();

    println!("Input source file path: {}", input_file.display());

    binary.leak()
}

/// Creates [`BinaryByteSource`] with the given bytes.
pub fn create_binary_bytesource(data: &'static [u8]) -> BinaryByteSource<Cursor<&'static [u8]>> {
    BinaryByteSource::new(Cursor::new(data))
}

/// Provide the content of the configuration environment variable [`CONFIG_ENV_VAR`] if exist.
pub fn get_config() -> Option<String> {
    std::env::var(CONFIG_ENV_VAR).ok()
}

#[derive(Debug, Clone, Default)]
/// Counters the different output possibilities of producer output.
/// The purpose of this struct is to convince the compiler that we are using all input
/// possibilities of producer to avoid unwanted optimizations.
pub struct ProducerCounter {
    pub items: usize,
    pub msg: usize,
    pub txt: usize,
    pub att: usize,
    pub loaded_bytes: usize,
    pub skipped_bytes: usize,
}

/// Run producer until the end converting messages into strings too, while counting all the
/// different types of producer outputs to avoid unwanted compiler optimizations.
pub async fn run_producer<P, B>(mut producer: MessageProducer<P, B>) -> ProducerCounter
where
    P: parsers::Parser,
    B: sources::ByteSource,
{
    let mut counter = ProducerCounter::default();
    let mut collector = GeneralLogCollector::default();

    loop {
        collector.get_records().clear();
        match producer.produce_next(&mut collector).await.unwrap() {
            processor::producer::ProduceSummary::Processed {
                bytes_consumed,
                messages_count,
                skipped_bytes,
            } => {
                counter.items += messages_count;
                counter.loaded_bytes += bytes_consumed;
                counter.skipped_bytes += skipped_bytes;
            }
            processor::producer::ProduceSummary::NoBytesAvailable { skipped_bytes } => {
                counter.skipped_bytes += skipped_bytes;
                break;
            }
            processor::producer::ProduceSummary::Done {
                loaded_bytes,
                skipped_bytes,
                produced_messages,
            } => {
                counter.loaded_bytes = loaded_bytes;
                counter.skipped_bytes = skipped_bytes;
                counter.items = produced_messages;
                break;
            }
        }

        for item in collector.get_records() {
            match item {
                ParseYield::Message(msg) => {
                    counter.msg += 1;
                    counter.txt += msg.to_string().len();
                }
                ParseYield::Attachment(att) => counter.att += att.size,
                ParseYield::MessageAndAttachment((msg, att)) => {
                    counter.msg += 1;
                    counter.txt += msg.to_string().len();
                    counter.att += att.size;
                }
            }
        }
    }

    counter
}

/// Sensible configuration for Criterion to run reduce the noise from the overhead
/// of async runtime, while keeping a reasonable run duration for the benchmarks.
///
/// # Note:
///
/// Even with these configurations, it's advisable to run the benchmarks multiple times to increase the
/// correctness of the results.
pub fn bench_standrad_config() -> Criterion {
    // Sample size can be additionally configured via environment variables
    let sample_size = std::env::var(SAMPLE_SIZE_ENV_VAR)
        .ok()
        .and_then(|s| s.parse().ok())
        .unwrap_or(200);

    Criterion::default()
        // Warm up time is very important here because multiple async runtimes will be spawn in
        // that time which make the next ones to spawn more stable.
        .warm_up_time(Duration::from_secs(10))
        // Measurement time and sample sized to role out noise in the measurements as possible.
        .measurement_time(Duration::from_secs(20))
        .sample_size(sample_size)
        // These two values help to reduce the noise level in the results.
        .significance_level(0.01)
        .noise_threshold(0.03)
}
