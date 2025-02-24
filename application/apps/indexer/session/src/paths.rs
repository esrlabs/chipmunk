use dirs;
use std::path::PathBuf;

const CHIPMUNK_HOME: &str = ".chipmunk";
const CHIPMUNK_TMP: &str = "tmp";

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
