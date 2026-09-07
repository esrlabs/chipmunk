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
use processor::producer::{LogRecordsCollector, MessageProducer};
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
        Ok(input) => PathBuf::from(input),
        Err(err) => panic!(
            "Error while retrieving input file.\nProvide the input file path via the \
             '{INPUT_SOURCE_ENV_VAR}' environment variable.\nError Info: {err}"
        ),
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

/// Byte count at which the sink of [`BenchCollector`] starts over. It bounds the memory of a
/// benchmark run while keeping the sink free of reallocations once it is warm.
const SINK_LIMIT: usize = 8 * 1024;

/// Collector which consumes the produced items the way a session does: every message is rendered
/// into a reusable buffer and dropped right away, instead of being kept and rendered a second
/// time. Counting happens on append, so a benchmark measures the producer and its parser and not
/// the bookkeeping of this harness.
pub struct BenchCollector {
    /// Destination of the message text. It is reused and never grows past [`SINK_LIMIT`], so no
    /// allocation is attributed to a message.
    sink: String,
    counter: ProducerCounter,
}

impl Default for BenchCollector {
    fn default() -> Self {
        Self {
            sink: String::with_capacity(SINK_LIMIT),
            counter: ProducerCounter::default(),
        }
    }
}

impl BenchCollector {
    /// Renders the message and counts it. Rendering rather than counting alone keeps the content
    /// of a message observable, which is what stops the optimizer from removing the work the
    /// parser did to produce it.
    ///
    /// It goes through [`fmt::Display`] because that is what the session does with a produced
    /// message.
    fn write_message<T: LogMessage>(&mut self, msg: &T) {
        use std::fmt::Write;

        // The barriers keep the message and the rendered bytes observable, so that no part of
        // the work the parser did can be optimized away.
        let msg = std::hint::black_box(msg);
        std::hint::black_box(&self.sink);

        if self.sink.len() >= SINK_LIMIT {
            self.sink.clear();
        }

        std::hint::black_box(&self.sink);
        let before = self.sink.len();
        // Writing into a string never fails.
        _ = writeln!(&mut self.sink, "{msg}");

        std::hint::black_box(&self.sink);
        self.counter.msg += 1;
        self.counter.txt += self.sink.len() - before;
    }
}

impl<T: LogMessage> LogRecordsCollector<T> for BenchCollector {
    fn append(&mut self, log_record: ParseYield<T>) {
        match log_record {
            ParseYield::Message(msg) => self.write_message(&msg),
            ParseYield::Attachment(att) => self.counter.att += att.size,
            ParseYield::MessageAndAttachment((msg, att)) => {
                self.write_message(&msg);
                self.counter.att += att.size;
            }
        }
    }
}

/// Run producer until the end, counting all the different types of producer outputs to avoid
/// unwanted compiler optimizations.
///
/// This drives the producer through [`MessageProducer::produce_next()`] on purpose: mirroring the
/// `fetch()` and `process()` loop of a session would put a copy of that loop here, which would
/// then drift away from the original.
pub async fn run_producer<P, B>(mut producer: MessageProducer<P, B>) -> ProducerCounter
where
    P: parsers::Parser,
    B: sources::ByteSource,
{
    let mut collector = BenchCollector::default();
    let mut items = 0;
    let mut loaded_bytes = 0;
    let mut skipped_bytes = 0;

    loop {
        match producer.produce_next(&mut collector).await.unwrap() {
            processor::producer::ProduceSummary::Processed {
                bytes_consumed,
                messages_count,
                skipped_bytes: skipped,
            } => {
                items += messages_count;
                loaded_bytes += bytes_consumed;
                skipped_bytes += skipped;
            }
            processor::producer::ProduceSummary::NoBytesAvailable {
                skipped_bytes: skipped,
            }
            | processor::producer::ProduceSummary::PendingRemainder {
                skipped_bytes: skipped,
            } => {
                skipped_bytes += skipped;
                break;
            }
            processor::producer::ProduceSummary::Done {
                loaded_bytes: total_loaded,
                skipped_bytes: total_skipped,
                produced_messages,
            } => {
                loaded_bytes = total_loaded;
                skipped_bytes = total_skipped;
                items = produced_messages;
                break;
            }
        }
    }

    ProducerCounter {
        items,
        loaded_bytes,
        skipped_bytes,
        ..collector.counter
    }
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
