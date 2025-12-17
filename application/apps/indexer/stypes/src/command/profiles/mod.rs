#[cfg(feature = "rustcore")]
mod extending;
#[cfg(feature = "nodejs")]
mod nodejs;
#[cfg(test)]
mod proptest;

use crate::*;

/// Represents most well known shells that are not used by default on OS.
#[derive(Debug, Clone, Copy, Eq, PartialEq, Serialize, Deserialize)]
#[extend::encode_decode]
#[cfg_attr(
    all(test, feature = "test_and_gen"),
    derive(TS),
    ts(export, export_to = "command.ts")
)]
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
#[extend::encode_decode]
#[cfg_attr(
    all(test, feature = "test_and_gen"),
    derive(TS),
    ts(export, export_to = "command.ts")
)]
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
#[extend::encode_decode]
#[cfg_attr(
    all(test, feature = "test_and_gen"),
    derive(TS),
    ts(export, export_to = "command.ts")
)]
pub struct ProfileList(pub Vec<ShellProfile>);
