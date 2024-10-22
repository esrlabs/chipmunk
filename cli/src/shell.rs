//! Provides struct representing the shell running by user besides a method to generate
//! completion of the CLI sub-commands and arguments for the given shell.

use std::{fmt::Display, io};

use anyhow::Context;
use clap::CommandFactory;
use clap_complete::{generate, Shell};
use serde::{Deserialize, Serialize};

use crate::{cli_args::CargoCli, user_config::UserConfiguration};

#[derive(Debug, Clone, Copy, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
/// Represents the shell running by users providing method to create commands to run process
/// on the given shell.
pub enum UserShell {
    Sh,
    Bash,
    Zsh,
    Fish,
    NuShell,
    Elvish,
    Cmd,
    PowerShell,
}

impl Default for UserShell {
    fn default() -> Self {
        if cfg!(windows) {
            UserShell::Cmd
        } else {
            UserShell::Sh
        }
    }
}

impl Display for UserShell {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            UserShell::Sh => write!(f, "SH"),
            UserShell::Bash => write!(f, "Bash"),
            UserShell::Zsh => write!(f, "ZSH"),
            UserShell::Fish => write!(f, "Fish"),
            UserShell::NuShell => write!(f, "Nu Shell"),
            UserShell::Elvish => write!(f, "Envish"),
            UserShell::Cmd => write!(f, "Cmd"),
            UserShell::PowerShell => write!(f, "Power Shell"),
        }
    }
}

impl UserShell {
    /// Provides [`std::process::Command`] to run a process on the given shell.
    pub fn std_command(self) -> std::process::Command {
        let mut cmd = std::process::Command::new(self.bin());
        cmd.arg(self.arg());

        cmd
    }

    /// Provides an asynchronous [`tokio::process::Command`] to run a process on the given shell.
    pub fn tokio_command(self) -> tokio::process::Command {
        let mut cmd = tokio::process::Command::new(self.bin());
        cmd.arg(self.arg());

        cmd
    }

    /// Binary name for the shell
    pub const fn bin(self) -> &'static str {
        match self {
            UserShell::Sh => "sh",
            UserShell::Bash => "bash",
            UserShell::Zsh => "zsh",
            UserShell::Fish => "fish",
            UserShell::NuShell => "nu",
            UserShell::Elvish => "elvish",
            UserShell::Cmd => "cmd",
            UserShell::PowerShell => "pwsh",
        }
    }

    /// Argument provided by each shell to run the provided process command and its arguments.
    const fn arg(self) -> &'static str {
        match self {
            UserShell::Sh
            | UserShell::Bash
            | UserShell::Zsh
            | UserShell::Fish
            | UserShell::NuShell
            | UserShell::Elvish => "-c",
            UserShell::Cmd => "/C",
            UserShell::PowerShell => "-Command",
        }
    }

    /// Checks if the shell exist on the system by running it with the version argument.
    pub fn exist(self) -> bool {
        std::process::Command::new(self.bin())
            .arg(self.version_arg())
            .output()
            .is_ok_and(|o| o.status.success())
    }

    /// Provides the argument to show the version of the given shell.
    const fn version_arg(self) -> &'static str {
        match self {
            UserShell::Sh
            | UserShell::Bash
            | UserShell::Zsh
            | UserShell::Fish
            | UserShell::NuShell
            | UserShell::Elvish => "--version",
            UserShell::Cmd => "/? ",
            UserShell::PowerShell => "-Version",
        }
    }
}

/// Creates [`std::process::Command`] running in the corresponding standard shell to each platform.
pub fn shell_std_command() -> std::process::Command {
    UserConfiguration::get().shell.std_command()
}

/// Creates [`tokio::process::Command`] running in the corresponding standard shell to each platform.
pub fn shell_tokio_command() -> tokio::process::Command {
    UserConfiguration::get().shell.tokio_command()
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
