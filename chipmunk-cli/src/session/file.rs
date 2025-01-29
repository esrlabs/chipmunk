use anyhow::Context;
use futures::StreamExt;
use std::{
    fmt::Write,
    fs::File,
    io::{BufWriter, Write as _},
    path::PathBuf,
};

use parsers::{LogMessage, Parser};
use sources::{producer::MessageProducer, ByteSource};

use super::{
    CHIPMUNK_DLT_ARGUMENT_SENTINAL, CHIPMUNK_DLT_COLUMN_SENTINAL, CLI_OUT_ARG_SEPARATOR,
    CLI_OUT_MAIN_SEPARATOR, ERROR_MSG,
};

pub async fn run_session<T, P, D>(parser: P, bytesource: D, output: PathBuf) -> anyhow::Result<()>
where
    T: LogMessage,
    P: Parser<T>,
    D: ByteSource,
{
    let mut producer = MessageProducer::new(parser, bytesource, None);
    let stream = producer.as_stream();
    tokio::pin!(stream);

    let mut origin_msg_buffer = String::new();
    let mut repalced_msg_buffer = String::new();

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

                    origin_msg_buffer.clear();
                    write!(&mut origin_msg_buffer, "{msg}").context(ERROR_MSG)?;

                    repalced_msg_buffer.clear();
                    let rep_buff = &mut repalced_msg_buffer;

                    for (idx, main) in origin_msg_buffer
                        .split(CHIPMUNK_DLT_COLUMN_SENTINAL)
                        .enumerate()
                    {
                        if idx != 0 {
                            write!(rep_buff, "{CLI_OUT_MAIN_SEPARATOR}").context(ERROR_MSG)?;
                        }
                        for (jdx, argument) in
                            main.split(CHIPMUNK_DLT_ARGUMENT_SENTINAL).enumerate()
                        {
                            // TODO AAZ: Current solution in chipmunk puts empty arguments on some
                            // of the messages.
                            if jdx != 0 {
                                write!(rep_buff, "{CLI_OUT_ARG_SEPARATOR}").context(ERROR_MSG)?;
                            }
                            write!(rep_buff, "{argument}").context(ERROR_MSG)?;
                        }
                    }

                    msg_count += 1;

                    writeln!(writer, "{repalced_msg_buffer}")
                        .context("Error while writing to output file")?;
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

    return Ok(());
}
