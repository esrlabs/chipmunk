use std::{fs::File, io::BufReader};

use anyhow::Context;
use clap::Parser as _;
use cli_args::InputSource;
use parsers::dlt::DltParser;
use sources::{
    binary::raw::BinaryByteSource,
    socket::{tcp::TcpSource, udp::UdpSource},
};

mod cli_args;
mod session;

pub async fn run_app() -> anyhow::Result<()> {
    let cli = cli_args::Cli::parse();
    cli.validate()?;

    // TODO AAZ: Make sure we don't have storage header with connections.

    match cli.input {
        InputSource::Tcp { ip } => {
            let source = TcpSource::new(ip)
                .await
                .context("Initializing TCP connection failed")?;

            let parser = DltParser::new(None, None, None, None, false);
            session::run_session(parser, source, cli.output).await?;
        }
        InputSource::Udp { ip } => {
            let source = UdpSource::new(ip, Vec::new())
                .await
                .context("Initializing UDP connection failed")?;
            let parser = DltParser::new(None, None, None, None, false);
            session::run_session(parser, source, cli.output).await?;
        }
        InputSource::File { path } => {
            let file = File::open(&path).context("Opening input file failed")?;
            let reader = BufReader::new(&file);
            let source = BinaryByteSource::new(reader);
            let parser = DltParser::new(None, None, None, None, true);
            session::run_session(parser, source, cli.output).await?;
        }
    }

    Ok(())
}
