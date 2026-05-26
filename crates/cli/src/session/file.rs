//! Provides methods for running a session with a file as the input source.

use anyhow::Context;
use std::{io::Write as _, path::PathBuf};
use tokio_util::sync::CancellationToken;

use parsers::{ParseYield, Parser};
use processor::producer::{GeneralLogCollector, MessageProducer, ProduceSummary};
use sources::ByteSource;

use crate::session::create_append_file_writer;

use super::format::MessageFormatter;

/// Message interval to print output status to stdout while parsing.
const UPDATE_MESSAGE_INTERVAL: usize = 5000;

/// Runs a parsing session considering that the parsing will run quickly
/// since the input is inside a file.
///
/// * `parser`: Parser instance to be used for parsing the bytes in the session.
/// * `bytesource`: Byte source instance to deliver the bytes in the session.
/// * `output_path`: The path for the output file path.
/// * `msg_formatter`: The formatter and writer for messages in the session.
/// * `cancel_token`: CancellationToken.
pub async fn run_session<P, D, W>(
    parser: P,
    bytesource: D,
    output_path: PathBuf,
    mut msg_formatter: W,
    cancel_token: CancellationToken,
) -> anyhow::Result<()>
where
    P: Parser,
    D: ByteSource,
    W: MessageFormatter,
{
    let mut producer = MessageProducer::new(parser, bytesource);
    let mut collector = GeneralLogCollector::default();

    let mut file_writer = create_append_file_writer(&output_path)?;

    let write_sum = |p: &mut MessageProducer<_, _>| {
        super::write_summary(
            p.total_produced_items(),
            p.total_loaded_bytes(),
            p.total_skipped_bytes(),
        );
    };

    let mut msg_count = 0;

    loop {
        collector.get_records().clear();
        tokio::select! {
            _ = cancel_token.cancelled() => {
                file_writer.flush().context("Error writing data to file.")?;
                write_sum(&mut producer);

                return Ok(());
            },
            res = producer.produce_next(&mut collector) => {
                let summary = res?;
                match summary {
                    ProduceSummary::Processed {..} => {
                        for record in collector.get_records() {
                           let msg =  match record {
                                ParseYield::Message(msg) => msg,
                                ParseYield::Attachment(..) => continue,
                                ParseYield::MessageAndAttachment((msg, _att)) => msg,
                            };
                            msg_formatter.write_msg(&mut file_writer, msg)?;

                            msg_count += 1;
                            if msg_count % UPDATE_MESSAGE_INTERVAL == 0 {
                                println!("Processing... {msg_count} messages have been written to file.");
                            }
                        }
                    },
                    // We don't support file tailing in the CLI tool.
                    ProduceSummary::NoBytesAvailable {..} | ProduceSummary::Done {..} => {
                        write_sum(&mut producer);
                        return Ok(());
                    },
                }
            }

        }
    }
}
