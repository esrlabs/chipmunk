use anyhow::Context;
use futures::StreamExt;
use std::{
    fmt::Write,
    fs::File,
    io::{BufWriter, Write as _},
    path::PathBuf,
    time::Duration,
};
use tokio::sync::mpsc::UnboundedReceiver;

use parsers::{LogMessage, Parser};
use sources::{producer::MessageProducer, socket::ReconnectStateMsg, ByteSource};

use super::{
    CHIPMUNK_DLT_ARGUMENT_SENTINAL, CHIPMUNK_DLT_COLUMN_SENTINAL, CLI_OUT_ARG_SEPARATOR,
    CLI_OUT_MAIN_SEPARATOR, ERROR_MSG,
};

pub async fn run_session<T, P, D>(
    parser: P,
    bytesource: D,
    output: PathBuf,
    mut state_rc: UnboundedReceiver<ReconnectStateMsg>,
    update_interval: Duration,
) -> anyhow::Result<()>
where
    T: LogMessage,
    P: Parser<T>,
    D: ByteSource,
{
    let mut producer = MessageProducer::new(parser, bytesource, None);
    let stream = producer.as_stream();
    tokio::pin!(stream);

    let mut update_interval = tokio::time::interval(update_interval);

    let mut origin_msg_buffer = String::new();
    let mut replaced_msg_buffer = String::new();

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

                            origin_msg_buffer.clear();
                            write!(&mut origin_msg_buffer, "{msg}").context(ERROR_MSG)?;

                            replaced_msg_buffer.clear();
                            let rep_buff = &mut replaced_msg_buffer;

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

                            writeln!(writer, "{replaced_msg_buffer}")
                                .context("Error while writing to output file")?;
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
