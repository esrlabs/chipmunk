use clap::Parser;

use app::ChipmunkApp;
use host::service::HostService;

mod app;
mod cli;
mod logging;

mod host;
mod session;

pub async fn run_app() -> anyhow::Result<()> {
    let _cli = cli::Cli::parse();

    logging::setup()?;

    let (ui_comm, state_comm) = host::communication::init();

    HostService::spawn(state_comm);

    ChipmunkApp::run(ui_comm).map_err(|err| anyhow::anyhow!("{err:?}"))
}
