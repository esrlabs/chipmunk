#[cfg(feature = "nodejs")]
mod nodejs;
#[cfg(test)]
mod proptest;

use crate::*;

#[derive(Clone, Serialize, Deserialize, Debug)]
#[extend::encode_decode]
#[cfg_attr(
    all(test, feature = "test_and_gen"),
    derive(TS),
    ts(export, export_to = "command.ts")
)]
pub struct Profile {
    /// Suggested name of shell. For unix based systems it will be name of executable file,
    /// like "bash", "fish" etc. For windows it will be names like "GitBash", "PowerShell"
    /// etc.
    pub name: String,
    /// Path to executable file of shell
    pub path: PathBuf,
    /// List of environment variables. Because extracting operation could take some time
    /// by default `envvars = None`. To load data should be used method `load`, which will
    /// make attempt to detect environment variables.
    #[cfg_attr(all(test, feature = "test_and_gen"), ts(type = "Map<string, string>"))]
    pub envvars: Option<HashMap<String, String>>,
    /// true - if path to executable file of shell is symlink to another location.
    pub symlink: bool,
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
pub struct ProfileList(pub Vec<Profile>);
