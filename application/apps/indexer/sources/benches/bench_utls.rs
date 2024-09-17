// Types here are used within benchmarks but rust checking isn't able to connect the module
// together yet.
#![allow(unused)]

use std::{
    fs::File,
    io::{Cursor, Read},
    path::PathBuf,
};

use parsers::{LogMessage, MessageStreamItem};
use sources::{binary::raw::BinaryByteSource, producer::MessageProducer};
use tokio_stream::StreamExt;

pub const INPUT_SOURCE_ENV_VAR: &str = "CHIPMUNK_BENCH_FILE";
pub const CONFIG_ENV_VAR: &str = "CHIPMUNK_BENCH_CONFIG";

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
        Err(err) => panic!("Error while retrieving input file.\nPlease ensure to provide the path of input file for benchmarks via environment variable: '{INPUT_SOURCE_ENV_VAR}'\n Error Info: {err}"),
    };

    assert!(input_file.exists(), "Given input file doesn't exist");

    let mut binary = Vec::new();

    let mut file = File::open(input_file).unwrap();
    file.read_to_end(&mut binary).unwrap();

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
    pub msg: usize,
    pub txt: usize,
    pub att: usize,
    pub skipped: usize,
    pub incomplete: usize,
    pub empty: usize,
}

/// Run producer until the end converting messages into strings too, while counting all the
/// different types of producer outputs to avoid unwanted compiler optimizations.
pub async fn run_producer<P, B, T>(mut producer: MessageProducer<T, P, B>) -> ProducerCounter
where
    P: parsers::Parser<T>,
    B: sources::ByteSource,
    T: LogMessage,
{
    let mut counter = ProducerCounter::default();

    let s = producer.as_stream();
    tokio::pin!(s);

    while let Some((_, i)) = s.next().await {
        match i {
            MessageStreamItem::Item(item) => match item {
                parsers::ParseYield::Message(msg) => {
                    counter.msg += 1;
                    counter.txt += msg.to_string().len();
                }
                parsers::ParseYield::Attachment(att) => counter.att += att.size,
                parsers::ParseYield::MessageAndAttachment((msg, att)) => {
                    counter.msg += 1;
                    counter.txt += msg.to_string().len();
                    counter.att += att.size;
                }
            },
            MessageStreamItem::Skipped => {
                counter.skipped += 1;
            }
            MessageStreamItem::Incomplete => counter.incomplete += 1,
            MessageStreamItem::Empty => counter.empty += 1,
            MessageStreamItem::Done => break,
        }
    }

    counter
}
