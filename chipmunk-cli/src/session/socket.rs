use anyhow::Context;
use futures::StreamExt;
use std::{
    fs::File,
    io::{BufWriter, Write as _},
    path::PathBuf,
    time::Duration,
};
use tokio::sync::mpsc::UnboundedReceiver;

use parsers::{LogMessage, Parser};
use sources::{producer::MessageProducer, socket::ReconnectStateMsg, ByteSource};

use super::format::MessageWriter;

pub async fn run_session<T, P, D, W>(
    parser: P,
    bytesource: D,
    output: PathBuf,
    mut msg_writer: W,
    mut state_rc: UnboundedReceiver<ReconnectStateMsg>,
    update_interval: Duration,
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

    let file = File::create(output).context("Error while creating output file")?;
    let mut writer = BufWriter::new(file);

    let mut msg_count = 0;
    let mut reconnecting = false;

    loop {
        tokio::select! {
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
                    println!("Processing... {msg_count} message has been written to file.");
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
                            msg_writer.write_msg(&mut writer, msg)?;

                            //TODO AAZ: Check if there is a better solution than calling
                            //flush on each line after implementing graceful shutdown.
                            writer
                                .flush()
                                .context("Error while writing to output file")?;

                            msg_count += 1;
                        }
                        parsers::MessageStreamItem::Skipped
                        | parsers::MessageStreamItem::Incomplete
                        | parsers::MessageStreamItem::Empty => {
                            //TODO AAZ: Deal with none expected value.
                            continue;
                        }
                        parsers::MessageStreamItem::Done => {
                            println!("Parsing Done. {msg_count} has been written to file.");
                            return Ok(());
                        }
                    }
                }
            }

        };
    }
}
