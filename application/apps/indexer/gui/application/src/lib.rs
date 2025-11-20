use clap::Parser;

use app::ChipmunkApp;

mod app;
mod cli;
mod comm_utls;
mod fixed_queue;
mod host;
mod logging;
mod session;

pub fn run_app() -> anyhow::Result<()> {
    let mut cli = cli::Cli::parse();

    let mut cli_cmds = Vec::new();

    if let Some(path) = cli.file_path.take() {
        let cmd = cli::CliCommand::OpenFile { path };
        cli_cmds.push(cmd);
    }

    logging::setup()?;

    ChipmunkApp::run(cli_cmds).map_err(|err| anyhow::anyhow!("{err:?}"))
}
