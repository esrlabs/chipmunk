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

/// Represents a list of serial ports.
///
/// This structure contains a vector of strings, where each string represents the name
/// or identifier of a serial port available on the system.
#[derive(Clone, Serialize, Deserialize, Debug)]
pub struct ProfileList(pub Vec<ShellProfile>);
