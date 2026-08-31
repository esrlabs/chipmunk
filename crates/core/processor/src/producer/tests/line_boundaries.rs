//! Regression tests for text lines which straddle a reader buffer boundary.
//!
//! These pair the real [`StringTokenizer`] with a real [`BinaryByteSource`] whose capacity is
//! injectable, which is the only level where the buffer sizes of the defect can be reproduced
//! without feeding megabytes into the test.

use std::io::{Cursor, Read};

use parsers::{
    ParseYield,
    text::{StringMessage, StringTokenizer},
};
use sources::binary::raw::BinaryByteSource;

use super::*;

/// Reader which hands out its content in small chunks, the way a socket or a slow writer does.
struct ChunkedRead {
    content: Vec<u8>,
    chunk_size: usize,
    position: usize,
}

impl Read for ChunkedRead {
    fn read(&mut self, buffer: &mut [u8]) -> std::io::Result<usize> {
        let chunk_end = (self.position + self.chunk_size).min(self.content.len());
        let size = buffer.len().min(chunk_end - self.position);
        buffer[..size].copy_from_slice(&self.content[self.position..self.position + size]);
        self.position += size;

        Ok(size)
    }
}

/// Drives the producer to the end of its input the way a caller which can't tail does: produce
/// until the source stalls, then let the parser close whatever it is still holding.
async fn collect_lines<R: Read + Send>(source: BinaryByteSource<R>) -> Vec<String> {
    let mut producer = MessageProducer::new(StringTokenizer {}, source);
    let mut collector = GeneralLogCollector::<StringMessage>::default();
    let mut lines = Vec::new();

    loop {
        let summary = producer.produce_next(&mut collector).await.unwrap();
        drain_lines(&mut collector, &mut lines);

        match summary {
            ProduceSummary::Processed { .. } => continue,
            ProduceSummary::PendingRemainder { .. } => {
                producer.process_remaining(&mut collector).unwrap();
                drain_lines(&mut collector, &mut lines);

                break;
            }
            ProduceSummary::NoBytesAvailable { .. } | ProduceSummary::Done { .. } => break,
        }
    }

    lines
}

fn drain_lines(collector: &mut GeneralLogCollector<StringMessage>, lines: &mut Vec<String>) {
    let records = collector
        .get_records()
        .drain(..)
        .map(|record| match record {
            ParseYield::Message(msg) => msg.to_string(),
            invalid => panic!("Text parser produces messages only but got {invalid:?}"),
        });

    lines.extend(records);
}

#[tokio::test]
async fn lines_crossing_buffer_boundaries_stay_whole() {
    // 9 bytes per line against a 64 byte buffer: every buffer boundary falls inside a line.
    let expected: Vec<String> = (0..30).map(|index| format!("line-{index:03}")).collect();
    let input = expected
        .iter()
        .map(|line| format!("{line}\n"))
        .collect::<String>();

    let source = BinaryByteSource::custom(Cursor::new(input.into_bytes()), 64, 16);

    assert_eq!(collect_lines(source).await, expected);
}

#[tokio::test]
async fn line_arriving_in_chunks_stays_whole() {
    let source = BinaryByteSource::custom(
        ChunkedRead {
            content: b"hello\nworld\n".to_vec(),
            chunk_size: 3,
            position: 0,
        },
        64,
        16,
    );

    assert_eq!(collect_lines(source).await, ["hello", "world"]);
}

#[tokio::test]
async fn last_line_without_newline_is_delivered() {
    let source = BinaryByteSource::custom(Cursor::new(b"one\ntwo".to_vec()), 64, 16);

    assert_eq!(collect_lines(source).await, ["one", "two"]);
}

#[tokio::test]
async fn line_longer_than_min_space_still_splits() {
    // Pins an accepted limitation: `BufReader` compacts only while the buffered bytes are below
    // its minimum, so a longer remainder sits at the end of a full buffer which can't grow. The
    // producer then has to emit it to keep the session going.
    let input = format!("{}\n{}\n", "S".repeat(20), "L".repeat(60));

    let source = BinaryByteSource::custom(Cursor::new(input.into_bytes()), 64, 8);

    // The first 64 bytes hold the short line plus the first 43 bytes of the long one.
    assert_eq!(
        collect_lines(source).await,
        ["S".repeat(20), "L".repeat(43), "L".repeat(17)]
    );
}

#[tokio::test]
async fn line_longer_than_the_buffer_splits_without_losing_bytes() {
    let input = format!("{}\n", "L".repeat(100));

    let source = BinaryByteSource::custom(Cursor::new(input.into_bytes()), 32, 8);

    // A line which doesn't fit the buffer at all can only be delivered in buffer sized pieces,
    // but no byte of it is lost and the run terminates.
    assert_eq!(
        collect_lines(source).await,
        [
            "L".repeat(32),
            "L".repeat(32),
            "L".repeat(32),
            "L".repeat(4)
        ]
    );
}
