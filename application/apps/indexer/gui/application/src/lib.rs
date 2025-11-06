use clap::Parser;

use app::ChipmunkApp;

mod app;
mod cli;
mod comm_utls;
mod fixed_queue;
mod host;
mod logging;
mod session;

pub async fn run_app() -> anyhow::Result<()> {
    let mut cli = cli::Cli::parse();

    let mut cli_cmds = Vec::new();

    if let Some(path) = cli.file_path.take() {
        let cmd = cli::CliCommand::OpenFile { path };
        cli_cmds.push(cmd);
    }

    logging::setup()?;

    // Tell the runtime that the main thread can block to avoid scheduling any
    // asynchronous work on the main thread, which is used and controlled by egui.
    //
    // TODO AAZ: Evaluate this in beta phase. The alternative is to call this function
    // when we call blocking commands in main and search tables.
    tokio::task::block_in_place(|| {
        ChipmunkApp::run(cli_cmds).map_err(|err| anyhow::anyhow!("{err:?}"))
    })
}
