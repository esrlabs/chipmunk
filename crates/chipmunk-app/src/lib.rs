use clap::Parser;

use crate::host::ui::Host;

mod cli;
mod common;
mod host;
mod session;

pub fn run_app() -> anyhow::Result<()> {
    let cli_cmds = cli::Cli::parse().get_commands();

    common::logging::setup()?;

    Host::run(cli_cmds).map_err(|err| anyhow::anyhow!("{err:?}"))
}
