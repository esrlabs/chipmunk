//! Shell types used to run process sources through a user shell.

mod extending;

use crate::*;

/// Represents most well known shells that are not used by default on OS.
#[derive(Debug, Clone, Copy, Eq, PartialEq, Serialize, Deserialize)]
pub enum ShellType {
    Bash,
    Zsh,
    Fish,
    NuShell,
    Elvish,
    /// PowerShell +7
    Pwsh,
}

#[derive(Clone, Serialize, Deserialize, Debug, PartialEq, Eq)]
pub struct ShellProfile {
    pub shell: ShellType,
    /// Path to executable file of shell
    pub path: PathBuf,
}
