use std::{
    fs::{File, OpenOptions},
    io::{BufReader, BufWriter},
    path::{Path, PathBuf},
    time::Duration,
};

use anyhow::Context;
use format::MessageFormatter;
use tokio_util::sync::CancellationToken;

use parsers::LogMessage;
use sources::{
    binary::raw::BinaryByteSource,
    socket::{tcp::TcpSource, udp::UdpSource, ReconnectInfo, ReconnectStateMsg},
};

use crate::cli_args::InputSource;

mod file;
pub mod format;
pub mod parser;
mod socket;

/// Starts session with the given parser and the provided infos about input source
/// and other session parameters.
///
/// * `parser`: Parser instance to be used for parsing the bytes in the session.
/// * `input_source`: The input source info for the session.
/// * `msg_formatter`: The formatter and writer for messages in the session.
/// * `output_path`: The path for the output file path.
/// * `cancel_token`: CancellationToken.
pub async fn start_session<T, P, W>(
    parser: P,
    input_source: InputSource,
    msg_formatter: W,
    output_path: PathBuf,
    cancel_token: CancellationToken,
) -> anyhow::Result<()>
where
    T: LogMessage,
    P: parsers::Parser<T>,
    W: MessageFormatter,
{
    match input_source {
        InputSource::Tcp {
            address,
            update_interval,
            max_reconnect_count,
            reconnect_interval,
        } => {
            let (state_tx, state_rx) = tokio::sync::watch::channel(ReconnectStateMsg::Connected);

            let reconnect = max_reconnect_count.and_then(|max| {
                // provide reconnect infos when max count exists and bigger than zero.
                (max > 0).then(|| {
                    ReconnectInfo::new(
                        max,
                        Duration::from_millis(reconnect_interval),
                        Some(state_tx),
                    )
                })
            });

            let update_interval = Duration::from_millis(update_interval);
            let source = TcpSource::new(address, reconnect)
                .await
                .context("Initializing TCP connection failed")?;

            socket::run_session(
                parser,
                source,
                output_path,
                msg_formatter,
                state_rx,
                update_interval,
                cancel_token,
            )
            .await?
        }
        InputSource::Udp { address } => {
            // UDP connections inherently support auto-connecting by design.
            let (_state_tx, state_rx) = tokio::sync::watch::channel(ReconnectStateMsg::Connected);

            let source = UdpSource::new(address, Vec::new())
                .await
                .context("Initializing UDP connection failed")?;

            let temp_interval = Duration::from_millis(1000);

            socket::run_session(
                parser,
                source,
                output_path,
                msg_formatter,
                state_rx,
                temp_interval,
                cancel_token,
            )
            .await?
        }
        InputSource::File { path } => {
            let file = File::open(&path).context("Opening input file failed")?;
            let reader = BufReader::new(&file);
            let source = BinaryByteSource::new(reader);

            file::run_session(parser, source, output_path, msg_formatter, cancel_token).await?;
        }
    }
    Ok(())
}

/// Writes summary of the process session.
fn write_summary(
    msg_count: usize,
    skipped_count: usize,
    empty_count: usize,
    incomplete_count: usize,
) {
    const UNDERLINE_ANSI: &str = "\x1b[4m";
    const RESET_ANSI: &str = "\x1b[0m";

    println!("{UNDERLINE_ANSI}Process Summary{RESET_ANSI}:");

    println!("* {msg_count} messages has been written to file.");
    if skipped_count > 0 {
        println!("* {skipped_count} messages skipped");
    }
    if empty_count > 0 {
        println!("* {empty_count} messages were empty");
    }
    if incomplete_count > 0 {
        println!("* {incomplete_count} messages were incomplete");
    }
}

/// Creates or append a file with the provided [`file_path`] returning its buffer writer.
fn create_append_file_writer(file_path: &Path) -> anyhow::Result<BufWriter<File>> {
    let file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(file_path)
        .context("Error while creating output file")?;
    let writer = BufWriter::new(file);

    Ok(writer)
}
