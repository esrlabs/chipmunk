//! Provides methods for running a session with a server socket as the input source.

use anyhow::Context;
use futures::StreamExt;
use std::{io::Write as _, ops::Deref, path::PathBuf, time::Duration};
use tokio::sync::watch;
use tokio_util::sync::CancellationToken;

use parsers::{LogMessage, Parser};
use sources::{producer::MessageProducer, socket::ReconnectStateMsg, ByteSource};

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
pub async fn run_session<T, P, D, W>(
    parser: P,
    bytesource: D,
    output_path: PathBuf,
    mut msg_formatter: W,
    mut state_rc: watch::Receiver<ReconnectStateMsg>,
    update_interval: Duration,
    cancel_token: CancellationToken,
) -> anyhow::Result<()>
where
    T: LogMessage,
    P: Parser<T>,
    D: ByteSource,
    W: MessageFormatter,
{
    let mut producer = MessageProducer::new(parser, bytesource, None);
    let stream = producer.as_stream();
    tokio::pin!(stream);

    let mut update_interval = tokio::time::interval(update_interval);

    let mut file_writer = create_append_file_writer(&output_path)?;

    // Flush the file writer every 500 milliseconds for users tailing the output
    // file when messages are receive in relative slow frequency.
    let mut flush_interval = tokio::time::interval(Duration::from_millis(500));

    // Counters to keep track on the status of the session.
    let mut msg_count = 0;
    let mut reconnecting = false;
    let mut skipped_count = 0;
    let mut empty_count = 0;
    let mut incomplete_count = 0;

    // Keep track how many message has been received since the last flush.
    let mut msg_since_last_flush = 0;

    loop {
        tokio::select! {
            _ = cancel_token.cancelled() => {
                file_writer.flush().context("Error writing data to file.")?;
                super::write_summary(msg_count, skipped_count, empty_count, incomplete_count);

                return Ok(());
            }
            Ok(_) = state_rc.changed() => {
                let msg = state_rc.borrow_and_update();
                match msg.deref() {
                    ReconnectStateMsg::Reconnecting { attempts } => {
                        reconnecting = true;
                        if *attempts == 0 {
                            println!("Connection to server lost. Trying to reconnect...");
                        }else {
                            println!("Reconnecting to TCP server. Attempt: {attempts}");
                        }
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
                    println!("Processing... {msg_count} messages have been written to file.");
                }
            }
            Some(items) = stream.next() => {
                for (_, item) in items {
                    match item {
                        parsers::MessageStreamItem::Item(parse_yield) => {
                            let msg = match parse_yield {
                                parsers::ParseYield::Message(msg) => msg,
                                parsers::ParseYield::Attachment(_attachment) => {
                                    // attachment are postponed for now.
                                    continue;
                                }
                                parsers::ParseYield::MessageAndAttachment((msg, _attachment)) => msg,
                            };
                            msg_formatter.write_msg(&mut file_writer, msg)?;
                            msg_since_last_flush += 1;

                            msg_count += 1;
                        }
                        parsers::MessageStreamItem::Skipped => skipped_count += 1,
                        parsers::MessageStreamItem::Incomplete => incomplete_count += 1,
                        parsers::MessageStreamItem::Empty => empty_count += 1,
                        parsers::MessageStreamItem::Done => {
                            println!("Parsing Done");
                            super::write_summary(msg_count, skipped_count, empty_count, incomplete_count);

                            return Ok(());
                        }
                    }
                }
            }
        };
    }
}
