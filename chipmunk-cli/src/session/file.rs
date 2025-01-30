use anyhow::Context;
use futures::StreamExt;
use std::{fs::File, io::BufWriter, path::PathBuf};

use parsers::{LogMessage, Parser};
use sources::{producer::MessageProducer, ByteSource};

use super::format::MessageWriter;

pub async fn run_session<T, P, D, W>(
    parser: P,
    bytesource: D,
    output: PathBuf,
    mut msg_writer: W,
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

    let file = File::create(output).context("Error while creating output file")?;
    let mut writer = BufWriter::new(file);

    let mut msg_count = 0;

    while let Some(items) = stream.next().await {
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

                    msg_count += 1;
                    if msg_count % 5000 == 0 {
                        println!("Parsing... {msg_count} message has been written to file sofar.");
                    }
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

    Ok(())
}
