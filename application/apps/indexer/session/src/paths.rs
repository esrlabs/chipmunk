//! Contains the paths for chipmunk home directory and it's sub-directories.

use dirs;
use std::path::PathBuf;

const CHIPMUNK_HOME: &str = ".chipmunk";
const CHIPMUNK_TMP: &str = "tmp";
const CHIPMUNK_DOWNLOADS: &str = "downloads";

pub fn get_home_dir() -> Result<PathBuf, stypes::NativeError> {
    if let Some(home) = dirs::home_dir() {
        Ok(home.join(CHIPMUNK_HOME))
    } else {
        Err(stypes::NativeError {
            severity: stypes::Severity::ERROR,
            kind: stypes::NativeErrorKind::Io,
            message: Some(String::from("Fail to find home folder")),
        })
    }
}

/// Gets streams directory path within Chipmunk home directory
/// creating it if it doesn't exit.
pub fn get_streams_dir() -> Result<PathBuf, stypes::NativeError> {
    let streams = get_home_dir()?.join(CHIPMUNK_TMP);
    if !streams.exists() {
        std::fs::create_dir_all(&streams).map_err(|e| stypes::NativeError {
            severity: stypes::Severity::ERROR,
            kind: stypes::NativeErrorKind::Io,
            message: Some(format!(
                "Fail to create streams folder {}: {}",
                streams.to_string_lossy(),
                e
            )),
        })?;
    }
    Ok(streams)
}

/// Gets downloads directory path within Chipmunk home directory.
pub fn get_chipmunk_downloads_dir() -> Result<PathBuf, stypes::NativeError> {
    let downloads = get_home_dir()?.join(CHIPMUNK_DOWNLOADS);

    Ok(downloads)
}
