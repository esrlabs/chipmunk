use std::fmt::Display;

use crate::*;

impl ShellType {
    pub const fn all() -> &'static [ShellType] {
        // Reminder to add new types here
        match ShellType::Bash {
            ShellType::Bash => {}
            ShellType::Zsh => {}
            ShellType::Fish => {}
            ShellType::NuShell => {}
            ShellType::Elvish => {}
            ShellType::Pwsh => {}
        };

        &[
            ShellType::Bash,
            ShellType::Zsh,
            ShellType::Fish,
            ShellType::NuShell,
            ShellType::Elvish,
            ShellType::Pwsh,
        ]
    }

    /// Argument provided by each shell to run the provided process command and its arguments.
    pub fn command_arg(self) -> &'static str {
        match self {
            ShellType::Bash
            | ShellType::Zsh
            | ShellType::Fish
            | ShellType::NuShell
            | ShellType::Elvish => "-c",
            ShellType::Pwsh => "-Command",
        }
    }

    /// Binary name for the shell
    pub fn binary_names(self) -> &'static [&'static str] {
        match self {
            ShellType::Bash => &["bash"],
            ShellType::Zsh => &["zsh"],
            ShellType::Fish => &["fish"],
            ShellType::NuShell => &["nu"],
            ShellType::Elvish => &["elvish"],
            ShellType::Pwsh => &["powershell", "pwsh"],
        }
    }
}

impl Display for ShellType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ShellType::Bash => f.write_str("Bash"),
            ShellType::Zsh => f.write_str("Zsh"),
            ShellType::Fish => f.write_str("Fish"),
            ShellType::NuShell => f.write_str("NuShell"),
            ShellType::Elvish => f.write_str("Elvish"),
            ShellType::Pwsh => f.write_str("PowerShell"),
        }
    }
}
