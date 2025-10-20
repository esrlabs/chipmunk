use clap::Parser;

use app::ChipmunkApp;

mod app;
mod cli;
mod logging;

mod host;
mod session;

pub async fn run_app() -> anyhow::Result<()> {
    let _cli = cli::Cli::parse();

    logging::setup()?;

    ChipmunkApp::run().map_err(|err| anyhow::anyhow!("{err:?}"))
}
