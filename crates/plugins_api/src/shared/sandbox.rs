//! Provides a sandboxed environment for managing temporary resources.  
use std::path::PathBuf;

/// Creates a temporary directory and returns its path when successful.
///
/// The directory is accessible for both reading and writing.
/// It is automatically deleted when the session ends.
pub fn temp_directory() -> Result<PathBuf, std::io::Error> {
    match super::chipmunk::shared::sandbox::temp_directory() {
        Ok(path) => Ok(path.into()),
        Err(err_msg) => Err(std::io::Error::other(err_msg)),
    }
}
