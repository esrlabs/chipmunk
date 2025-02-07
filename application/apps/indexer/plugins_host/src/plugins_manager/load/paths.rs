use std::path::PathBuf;

use crate::plugins_manager::InitError;

/// The name of the plugins directory in Chipmunk home directory.
const PLUGINS_DIR: &str = "plugins";

/// The name of the parser plugins directory in plugins directory.
const PARSER_DIR: &str = "parsers";

/// The name of the byte-source plugins directory in plugins directory.
const BYTESOURCE_DIR: &str = "bytesources";

/// Copied from `session/src/paths.rs`
/// TODO AAZ: Use global function everywhere in rust core.
pub fn get_home_dir() -> Result<PathBuf, InitError> {
    const CHIPMUNK_HOME: &str = ".chipmunk";
    dirs::home_dir()
        .map(|home| home.join(CHIPMUNK_HOME))
        .ok_or_else(|| InitError::Other(String::from("Failed to find home directory")))
}

/// Return plugins directory in Chipmunk home directory.
pub fn plugins_dir() -> Result<PathBuf, InitError> {
    get_home_dir().map(|home| home.join(PLUGINS_DIR))
}

/// Returns parser plugins directory within Chipmunk home directory.
pub fn parser_dir() -> Result<PathBuf, InitError> {
    plugins_dir().map(|plugins| plugins.join(PARSER_DIR))
}

/// Returns byte-source plugins directory within Chipmunk home directory.
pub fn bytesource_dir() -> Result<PathBuf, InitError> {
    plugins_dir().map(|plugins| plugins.join(BYTESOURCE_DIR))
}
