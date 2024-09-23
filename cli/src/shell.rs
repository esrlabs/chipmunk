//! Provides the methods to generate completion of the CLI sub-commands and arguments for the given
//! shell.

use std::io;

use anyhow::Context;
use clap::CommandFactory;
use clap_complete::{generate, Shell};

use crate::cli_args::CargoCli;

/// Creates [`std::process::Command`] running in the corresponding standard shell to each platform.
pub fn shell_std_command() -> std::process::Command {
    use std::process::Command;

    if cfg!(target_os = "windows") {
        let mut cmd = Command::new("cmd");
        cmd.arg("/C");

        cmd
    } else {
        let mut cmd = Command::new("sh");
        cmd.arg("-c");

        cmd
    }
}

/// Creates [`tokio::process::Command`] running in the corresponding standard shell to each platform.
pub fn shell_tokio_command() -> tokio::process::Command {
    use tokio::process::Command;

    if cfg!(target_os = "windows") {
        let mut cmd = Command::new("cmd");
        cmd.arg("/C");

        cmd
    } else {
        let mut cmd = Command::new("sh");
        cmd.arg("-c");

        cmd
    }
}

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
