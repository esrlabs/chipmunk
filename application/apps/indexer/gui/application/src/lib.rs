use clap::Parser;

use app::ChipmunkApp;
use host::service::HostService;

use crate::host::data::HostState;

mod app;
mod cli;
mod logging;

mod host;
mod session;

pub async fn run_app() -> anyhow::Result<()> {
    let _cli = cli::Cli::parse();

    logging::setup()?;

    let (ui_comm, service_comm) = host::communication::init(HostState::default());

    HostService::spawn(service_comm);

    ChipmunkApp::run(ui_comm).map_err(|err| anyhow::anyhow!("{err:?}"))
}
