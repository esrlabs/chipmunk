use clap::Parser;

use app::ChipmunkApp;
use service::app_service::AppService;

mod app;
mod cli;
mod core;
mod logging;
mod service;
mod state;
mod ui;

pub async fn run_app() -> anyhow::Result<()> {
    let _cli = cli::Cli::parse();

    logging::setup()?;

    let (ui_comm, state_comm) = core::communication::init();

    AppService::spawn(state_comm);

    ChipmunkApp::run(ui_comm).map_err(|err| anyhow::anyhow!("{err:?}"))
}
