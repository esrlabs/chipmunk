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
    #[cfg(unix)]
    Sh,
    #[cfg(windows)]
    Cmd,
    Bash,
    Zsh,
    Fish,
    NuShell,
    Elvish,
    PowerShell,
}

impl Display for UserShell {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            #[cfg(unix)]
            UserShell::Sh => write!(f, "Sh"),
            #[cfg(windows)]
            UserShell::Cmd => write!(f, "Cmd"),
            UserShell::Bash => write!(f, "Bash"),
            UserShell::Zsh => write!(f, "Zsh"),
            UserShell::Fish => write!(f, "Fish"),
            UserShell::NuShell => write!(f, "Nu Shell"),
            UserShell::Elvish => write!(f, "Envish"),
            UserShell::PowerShell => write!(f, "Power Shell"),
        }
    }
}

#[cfg(unix)]
impl Default for UserShell {
    fn default() -> Self {
        use std::sync::LazyLock;
        // Try to retrieve the default shell from the environment variable if available,
        // otherwise use 'sh'
        static DEFAULT_SHELL: LazyLock<UserShell> = LazyLock::new(|| {
            let shell = std::env::var("SHELL")
                .ok()
                .and_then(|shell| shell.rsplit('/').next().map(|a| a.to_owned()))
                .map(|shell| match shell.to_lowercase().as_str() {
                    "bash" => UserShell::Bash,
                    "zsh" => UserShell::Zsh,
                    "fish" => UserShell::Fish,
                    "pwsh" => UserShell::PowerShell,
                    "nu" => UserShell::NuShell,
                    "elvish" => UserShell::Elvish,
                    _ => UserShell::Sh,
                })
                .unwrap_or(UserShell::Sh);

            shell
        });

        *DEFAULT_SHELL
    }
}

#[cfg(windows)]
impl Default for UserShell {
    fn default() -> Self {
        UserShell::Cmd
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
            #[cfg(unix)]
            UserShell::Sh => "sh",
            #[cfg(windows)]
            UserShell::Cmd => "cmd",
            UserShell::Bash => "bash",
            UserShell::Zsh => "zsh",
            UserShell::Fish => "fish",
            UserShell::NuShell => "nu",
            UserShell::Elvish => "elvish",
            UserShell::PowerShell => "pwsh",
        }
    }

    /// Argument provided by each shell to run the provided process command and its arguments.
    const fn arg(self) -> &'static str {
        match self {
            #[cfg(unix)]
            UserShell::Sh => "-c",
            #[cfg(windows)]
            UserShell::Cmd => "/C",
            UserShell::Bash
            | UserShell::Zsh
            | UserShell::Fish
            | UserShell::NuShell
            | UserShell::Elvish => "-c",
            UserShell::PowerShell => "-Command",
        }
    }

    /// Checks if the shell exist on the system by running it with the version argument.
    pub fn exist(self) -> bool {
        // Default shells are always installed on their respecting operating system and don't need
        // extra checks avoiding other potential problem because `sh` doesn't have a version
        // argument.
        let version_arg = match self {
            #[cfg(unix)]
            UserShell::Sh => return true,
            #[cfg(windows)]
            UserShell::Cmd => return true,
            UserShell::Bash
            | UserShell::Zsh
            | UserShell::Fish
            | UserShell::NuShell
            | UserShell::Elvish => "--version",
            UserShell::PowerShell => "-Version",
        };

        // Other wise run the shell with version argument to check if exists.
        std::process::Command::new(self.bin())
            .arg(version_arg)
            .output()
            .is_ok_and(|o| o.status.success())
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
