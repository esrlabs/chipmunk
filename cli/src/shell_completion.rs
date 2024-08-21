//! Provides the methods to generate completion of the CLI sub-commands and arguments for the given
//! shell.

use std::io;

use anyhow::Context;
use clap::CommandFactory;
use clap_complete::{generate, Shell};

use crate::cli_args::CargoCli;

/// Generates shell completion for the given shell printing them to stdout
pub fn generate_completion(shell: Shell) -> anyhow::Result<()> {
    let mut cmd = CargoCli::command();
    let bin_name = cmd
        .get_bin_name()
        .context("Error while getting bin name")?
        .to_owned();

    generate(shell, &mut cmd, bin_name, &mut io::stdout());
    Ok(())
}
