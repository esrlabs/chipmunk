use anyhow::Context;
use futures::StreamExt;
use std::{io::Write as _, path::PathBuf, time::Duration};
use tokio::sync::mpsc::UnboundedReceiver;
use tokio_util::sync::CancellationToken;

use parsers::{LogMessage, Parser};
use sources::{producer::MessageProducer, socket::ReconnectStateMsg, ByteSource};

use crate::session::create_append_file_writer;

use super::format::MessageWriter;

pub async fn run_session<T, P, D, W>(
    parser: P,
    bytesource: D,
    output: PathBuf,
    mut msg_writer: W,
    mut state_rc: UnboundedReceiver<ReconnectStateMsg>,
    update_interval: Duration,
    cancel_token: CancellationToken,
) -> anyhow::Result<()>
where
    T: LogMessage,
    P: Parser<T>,
    D: ByteSource,
    W: MessageWriter,
{
    let mut producer = MessageProducer::new(parser, bytesource, None);
    let stream = producer.as_stream();
    tokio::pin!(stream);

    let mut update_interval = tokio::time::interval(update_interval);

    let mut file_writer = create_append_file_writer(&output)?;

    let mut msg_count = 0;
    let mut reconnecting = false;
    let mut skipped_count = 0;
    let mut empty_count = 0;
    let mut incomplete_count = 0;
    loop {
        tokio::select! {
            _ = cancel_token.cancelled() => {
                file_writer.flush().context("Error writing data to file.")?;
                super::write_summary(msg_count, skipped_count, empty_count, incomplete_count);

                return Ok(());
            }
            Some(msg) = state_rc.recv() => {
                match msg {
                    ReconnectStateMsg::Reconnecting => {
                        reconnecting = true;
                        println!("Connection to server lost. Trying to reconnect...");
                    },
                    ReconnectStateMsg::Connected => {
                        reconnecting = false;
                        println!("Connected to server");
                    },
                    ReconnectStateMsg::StateMsg(msg) => {
                        println!("Reconnecting status: {msg}");
                    },
                }
            },
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
                            msg_writer.write_msg(&mut file_writer, msg)?;

                            //TODO AAZ: Check if we still need to flush on each line even with
                            //graceful shutdown.
                            ////flush on each line after implementing graceful shutdown.
                            //writer
                            //    .flush()
                            //    .context("Error while writing to output file")?;

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
