//! Cleanup of temp files and directories created by Chipmunk that haven't
//! gotten cleaned up properly.

use std::{
    fs, io,
    path::{Path, PathBuf},
    time::{Duration, SystemTime},
};

use log::error;
use semver::Version;
use session_core::{paths::get_chipmunk_downloads_dir, temp_dir::InstanceTempDir};
use stypes::{NativeError, NativeErrorKind, Severity};

use crate::{common::app_info, host::service::update::version_dir_prefix};

/// Cleans up temporary files that were left behind by instances which didn't shut down normally,
/// using `temp_dir` to tell this instance's files from theirs.
///
/// Both cleanups are always attempted, failures are logged only since the caller
/// has no way to recover from them.
pub fn cleanup_temp_files(temp_dir: Option<&InstanceTempDir>) {
    if let Some(temp_dir) = temp_dir
        && let Err(err) = cleanup_temp_dir(temp_dir)
    {
        error!("Error while cleaning up temporary files. Error: {err:?}");
    }

    if let Err(err) = cleanup_download_dir() {
        error!("Error while cleaning up downloaded files. Error: {err:?}");
    }
}

/// Removes the temp files of instances that aren't running anymore, falling back to the age
/// limit for entries no instance lock can decide about.
fn cleanup_temp_dir(temp_dir: &InstanceTempDir) -> Result<(), NativeError> {
    const ONE_MONTH: Duration = Duration::from_secs(30 * 24 * 60 * 60);

    temp_dir.sweep_leftovers(stale_before(ONE_MONTH)?)?;

    Ok(())
}

/// Modification time before which an entry counts as stale.
fn stale_before(max_age: Duration) -> Result<SystemTime, NativeError> {
    SystemTime::now()
        .checked_sub(max_age)
        .ok_or_else(|| NativeError {
            severity: Severity::ERROR,
            kind: NativeErrorKind::Io,
            message: Some(String::from(
                "Error while calculating modification time limit",
            )),
        })
}

/// Iterates through chipmunk downloads directory and remove stale entries alongside
/// with the staging directories of the running version.
fn cleanup_download_dir() -> Result<(), NativeError> {
    const ONE_WEEK: Duration = Duration::from_secs(7 * 24 * 60 * 60);

    let download_dir = get_chipmunk_downloads_dir()?;
    if !download_dir.exists() {
        return Ok(());
    }

    // Staging directories of the running version can't belong to an install in
    // progress because the app has just started.
    let date_limit = stale_before(ONE_WEEK)?;
    let current_version = app_info::current_version();
    cleanup_download_entries(&download_dir, date_limit, current_version)?;

    Ok(())
}

/// Clean stale entries within the given path, plus the staging directories of the
/// given version.
fn cleanup_download_entries(
    path: &Path,
    modified_date_limit: SystemTime,
    version: &Version,
) -> io::Result<()> {
    if !path.exists() {
        return Ok(());
    }

    let prefix = version_dir_prefix(version);

    fs::read_dir(path)?
        .flat_map(Result::ok)
        .filter(|entry| {
            is_stale_entry(entry, modified_date_limit) || is_prefixed_dir(entry, &prefix)
        })
        .map(|entry| entry.path())
        .try_for_each(remove_entry)
}

/// Returns `true` when the entry was last modified before the given limit.
fn is_stale_entry(entry: &fs::DirEntry, modified_date_limit: SystemTime) -> bool {
    entry
        .metadata()
        .is_ok_and(|meta| meta.modified().is_ok_and(|date| date < modified_date_limit))
}

fn is_prefixed_dir(entry: &fs::DirEntry, prefix: &str) -> bool {
    entry.file_type().is_ok_and(|file_type| file_type.is_dir())
        && entry
            .file_name()
            .to_str()
            .is_some_and(|name| name.starts_with(prefix))
}

fn remove_entry(path: PathBuf) -> io::Result<()> {
    if path.is_dir() {
        fs::remove_dir_all(path)
    } else if path.is_file() {
        fs::remove_file(path)
    } else {
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use std::{
        fs::{self, File},
        time::{Duration, SystemTime},
    };

    use semver::Version;

    use super::cleanup_download_entries;

    #[test]
    fn cleanup_download_entries_removes_matching_prefix_dirs() {
        let tempdir = tempfile::tempdir().unwrap();
        let temp_path = tempdir.path();

        let current_update = temp_path.join("update_4.0.1_123");
        fs::create_dir_all(current_update.join("artifact/archive-stage-123")).unwrap();
        File::create(current_update.join("artifact/archive-stage-123/chipmunk-update.ps1"))
            .unwrap();

        let other_update = temp_path.join("update_4.0.2_123");
        fs::create_dir(&other_update).unwrap();

        let matching_file = temp_path.join("update_4.0.1_file");
        File::create(&matching_file).unwrap();

        let old_limit = SystemTime::now()
            .checked_sub(Duration::from_secs(3600))
            .unwrap();
        cleanup_download_entries(temp_path, old_limit, &Version::new(4, 0, 1)).unwrap();

        assert!(!current_update.exists());
        assert!(other_update.exists());
        assert!(matching_file.exists());
    }
}
