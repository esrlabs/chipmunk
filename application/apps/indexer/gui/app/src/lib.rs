use clap::Parser;

use crate::app::ChipmunkApp;

mod app;
mod cli;
mod logging;
mod ui;

pub fn run_app() -> anyhow::Result<()> {
    let _cli = cli::Cli::parse();

    logging::setup()?;

    ChipmunkApp::run().map_err(|err| anyhow::anyhow!("{err:?}"))
}
