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
    socket::{
        tcp::{
            KeepAliveConfig, TcpSource,
            reconnect::{ReconnectInfo, ReconnectStateMsg},
        },
        udp::UdpSource,
    },
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
            keep_alive,
        } => {
            let (state_tx, state_rx) = tokio::sync::watch::channel(ReconnectStateMsg::Connected);

            let reconnect = max_reconnect_count.and_then(|max| {
                // provide reconnect infos when max count exists and bigger than zero.
                (max > 0).then(|| {
                    ReconnectInfo::new(max, Duration::from_secs(reconnect_interval), Some(state_tx))
                })
            });

            let update_interval = Duration::from_secs(update_interval);

            let keepalive = keep_alive.map(|keepalive_secs| {
                let keep_duration = Duration::from_secs(keepalive_secs);
                KeepAliveConfig::new(keep_duration, keep_duration)
            });

            let source = TcpSource::new(&address, keepalive, reconnect)
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
        InputSource::Udp {
            address,
            update_interval,
        } => {
            // UDP connections inherently support auto-connecting by design.
            let (_state_tx, state_rx) = tokio::sync::watch::channel(ReconnectStateMsg::Connected);

            let source = UdpSource::new(address, Vec::new())
                .await
                .context("Initializing UDP connection failed")?;

            let temp_interval = Duration::from_secs(update_interval);

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
fn write_summary(msg_count: usize, loaded_bytes: usize, skipped_bytes: usize) {
    const UNDERLINE_ANSI: &str = "\x1b[4m";
    const RESET_ANSI: &str = "\x1b[0m";

    println!("{UNDERLINE_ANSI}Process Summary{RESET_ANSI}:");

    println!("* {msg_count} messages has been written to file.");
    println!("* {loaded_bytes} bytes has been loaded from source.");
    println!("* {skipped_bytes} bytes has been skipped.");
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
