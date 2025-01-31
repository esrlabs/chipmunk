use anyhow::Context;
use clap::Parser as _;
use std::{fs::File, io::BufReader, time::Duration};
use tokio_util::sync::CancellationToken;

use cli_args::InputSource;
use parsers::dlt::DltParser;
use session::format::{binary::BinaryMessageWriter, text::MessageTextWriter};
use sources::{
    binary::raw::BinaryByteSource,
    socket::{tcp::TcpSource, udp::UdpSource, ReconnectInfo},
};

mod cli_args;
mod session;

pub async fn run_app(cancel_token: CancellationToken) -> anyhow::Result<()> {
    let cli = cli_args::Cli::parse();
    cli.validate()?;

    let (state_tx, state_rx) = tokio::sync::mpsc::unbounded_channel();

    match cli.input {
        InputSource::Tcp {
            address,
            update_interval,
            max_reconnect_count,
            reconnect_interval,
        } => {
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

            let parser = DltParser::new(None, None, None, None, false);

            match cli.output_format {
                cli_args::OutputFormat::Binary => {
                    session::socket::run_session(
                        parser,
                        source,
                        cli.output_path,
                        BinaryMessageWriter::default(),
                        state_rx,
                        update_interval,
                        cancel_token,
                    )
                    .await?
                }
                cli_args::OutputFormat::Text => {
                    session::socket::run_session(
                        parser,
                        source,
                        cli.output_path,
                        MessageTextWriter::new(cli.text_columns_separator, cli.text_args_separator),
                        state_rx,
                        update_interval,
                        cancel_token,
                    )
                    .await?
                }
            }
        }
        InputSource::Udp { address } => {
            let source = UdpSource::new(address, Vec::new())
                .await
                .context("Initializing UDP connection failed")?;
            let parser = DltParser::new(None, None, None, None, false);
            let temp_interval = Duration::from_millis(1000);
            match cli.output_format {
                cli_args::OutputFormat::Binary => {
                    session::socket::run_session(
                        parser,
                        source,
                        cli.output_path,
                        BinaryMessageWriter::default(),
                        state_rx,
                        temp_interval,
                        cancel_token,
                    )
                    .await?
                }
                cli_args::OutputFormat::Text => {
                    session::socket::run_session(
                        parser,
                        source,
                        cli.output_path,
                        MessageTextWriter::new(cli.text_columns_separator, cli.text_args_separator),
                        state_rx,
                        temp_interval,
                        cancel_token,
                    )
                    .await?
                }
            }
        }
        InputSource::File { path } => {
            let file = File::open(&path).context("Opening input file failed")?;
            let reader = BufReader::new(&file);
            let source = BinaryByteSource::new(reader);
            let parser = DltParser::new(None, None, None, None, true);
            match cli.output_format {
                cli_args::OutputFormat::Binary => {
                    session::file::run_session(
                        parser,
                        source,
                        cli.output_path,
                        BinaryMessageWriter::default(),
                        cancel_token,
                    )
                    .await?;
                }
                cli_args::OutputFormat::Text => {
                    session::file::run_session(
                        parser,
                        source,
                        cli.output_path,
                        MessageTextWriter::new(cli.text_columns_separator, cli.text_args_separator),
                        cancel_token,
                    )
                    .await?;
                }
            }
        }
    }

    Ok(())
}
