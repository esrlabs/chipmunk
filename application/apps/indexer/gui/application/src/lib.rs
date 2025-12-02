use clap::Parser;

use crate::host::ui::Host;

mod cli;
mod common;
mod host;
mod session;

pub fn run_app() -> anyhow::Result<()> {
    let mut cli = cli::Cli::parse();

    let mut cli_cmds = Vec::new();

    if let Some(path) = cli.file_path.take() {
        let cmd = cli::CliCommand::OpenFile { path };
        cli_cmds.push(cmd);
    }

    common::logging::setup()?;

    Host::run(cli_cmds).map_err(|err| anyhow::anyhow!("{err:?}"))
}
