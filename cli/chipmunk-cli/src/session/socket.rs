//! Provides methods for running a session with a server socket as the input source.

use anyhow::Context;
use std::{io::Write as _, ops::Deref, path::PathBuf, time::Duration};
use tokio::sync::watch;
use tokio_util::sync::CancellationToken;

use parsers::{ParseYield, Parser};
use processor::producer::{GeneralLogCollector, MessageProducer, ProduceSummary};
use sources::{ByteSource, socket::tcp::reconnect::ReconnectStateMsg};

use crate::session::create_append_file_writer;

use super::format::MessageFormatter;

/// Runs a parsing session considering that the parsing speed is dependent on the
/// frequency of the incoming messages from the server.
///
/// * `parser`: Parser instance to be used for parsing the bytes in the session.
/// * `bytesource`: Byte source instance to deliver the bytes in the session.
/// * `output_path`: The path for the output file path.
/// * `msg_formatter`: The formatter and writer for messages in the session.
/// * `state_rc`: Receiver for status of reconnecting process in case connection is lost.
/// * `update_interval`: The interval to print the state to stdout.
/// * `cancel_token`: CancellationToken.
pub async fn run_session<P, D, W>(
    parser: P,
    bytesource: D,
    output_path: PathBuf,
    mut msg_formatter: W,
    mut state_rc: watch::Receiver<ReconnectStateMsg>,
    update_interval: Duration,
    cancel_token: CancellationToken,
) -> anyhow::Result<()>
where
    P: Parser,
    D: ByteSource,
    W: MessageFormatter,
{
    let mut producer = MessageProducer::new(parser, bytesource);

    let mut update_interval = tokio::time::interval(update_interval);

    let mut file_writer = create_append_file_writer(&output_path)?;

    let mut collector = GeneralLogCollector::default();

    // Flush the file writer every 500 milliseconds for users tailing the output
    // file when messages are receive in relative slow frequency.
    let mut flush_interval = tokio::time::interval(Duration::from_millis(500));

    // Counters to keep track on the status of the session.
    let mut reconnecting = false;

    // Keep track how many message has been received since the last flush.
    let mut msg_since_last_flush = 0;

    let write_sum = |p: &mut MessageProducer<_, _>| {
        super::write_summary(
            p.total_produced_items(),
            p.total_loaded_bytes(),
            p.total_skipped_bytes(),
        );
    };

    loop {
        tokio::select! {
            _ = cancel_token.cancelled() => {
                file_writer.flush().context("Error writing data to file.")?;
                write_sum(&mut producer);

                return Ok(());
            }
            Ok(_) = state_rc.changed() => {
                let msg = state_rc.borrow_and_update();
                match msg.deref() {
                    ReconnectStateMsg::Reconnecting { attempts } => {
                        reconnecting = true;
                        if *attempts == 1 {
                            println!("Connection to server lost. Trying to reconnect...");
                        }
                        println!("Reconnecting to TCP server. Attempt: {attempts}");

                    },
                    ReconnectStateMsg::Connected => {
                        reconnecting = false;
                        println!("Connected to server");
                    },
                    ReconnectStateMsg::Failed{ attempts, err_msg } => {
                        let mut msg = format!("Reconnecting to TCP server failed after {attempts} attempts.");
                        if let Some(err_msg) = err_msg {
                            msg = format!("{msg} Error: {err_msg}");
                        }
                        println!("{msg}");
                    },
                }
            },
            _ = flush_interval.tick() => {
                if msg_since_last_flush > 0 {
                    msg_since_last_flush = 0;
                    file_writer.flush().context("Error while writing to output file")?;
                }
            }
            _ = update_interval.tick() => {
                if !reconnecting {
                    let msg_count = producer.total_produced_items();
                    println!("Processing... {msg_count} messages have been written to file.");
                }
            }
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
                            msg_since_last_flush += 1;
                        }
                    },
                    // No tailing support for streams.
                    ProduceSummary::NoBytesAvailable {..} | ProduceSummary::Done {..} => {
                        write_sum(&mut producer);
                        return Ok(());
                    },
                }
            }
        };
    }
}
