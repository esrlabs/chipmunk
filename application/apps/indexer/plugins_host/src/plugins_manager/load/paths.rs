//TODO: Remove after prototyping
#![allow(unused)]
use std::path::PathBuf;

use crate::plugins_manager::InitError;

const PLUGINS_DIR: &str = "plugins";
const PARSER_DIR: &str = "parser";
const BYTESOURCE_DIR: &str = "bytesource";

/// Copied from `session/src/paths.rs`
/// TODO AAZ: Use global function everywhere in rust core.
pub fn get_home_dir() -> Result<PathBuf, InitError> {
    const CHIPMUNK_HOME: &str = ".chipmunk";
    dirs::home_dir()
        .map(|home| home.join(CHIPMUNK_HOME))
        .ok_or_else(|| InitError::Other(String::from("Failed to find home directory")))
}

pub fn plugins_dir() -> Result<PathBuf, InitError> {
    get_home_dir().map(|home| home.join(PLUGINS_DIR))
}

pub fn parser_dir() -> Result<PathBuf, InitError> {
    plugins_dir().map(|plugins| plugins.join(PARSER_DIR))
}

pub fn bytesource_dir() -> Result<PathBuf, InitError> {
    plugins_dir().map(|plugins| plugins.join(BYTESOURCE_DIR))
}
