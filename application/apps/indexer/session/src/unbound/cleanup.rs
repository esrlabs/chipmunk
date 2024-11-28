use std::{
    fs, io,
    path::Path,
    time::{Duration, SystemTime},
};

use crate::paths::get_streams_dir;

/// Iterates through chipmunk temporary directory and remove the entries which is older
/// than two months.
pub fn cleanup_temp_dir() -> Result<(), stypes::NativeError> {
    let tmp_dir = get_streams_dir()?;

    const TWO_MONTHS_SECONDS: u64 = 60 * 60 * 24 * 60;
    let modified_limit = SystemTime::now()
        .checked_sub(Duration::from_secs(TWO_MONTHS_SECONDS))
        .ok_or_else(|| stypes::NativeError {
            severity: stypes::Severity::ERROR,
            kind: stypes::NativeErrorKind::Io,
            message: Some(String::from(
                "Error while calculating modification time limit",
            )),
        })?;

    cleanup_dir(&tmp_dir, modified_limit)?;

    Ok(())
}

// Clean files and directory within the given path that have a modified time older than
// the given modified date limit
fn cleanup_dir(path: &Path, modified_date_limit: SystemTime) -> io::Result<()> {
    if !path.exists() {
        return Ok(());
    }

    fs::read_dir(path)?
        .flat_map(Result::ok)
        .filter(|p| {
            p.metadata()
                .is_ok_and(|meta| meta.modified().is_ok_and(|date| date < modified_date_limit))
        })
        .map(|entry| entry.path())
        .try_for_each(|path| {
            if path.is_dir() {
                fs::remove_dir_all(path)
            } else if path.is_file() {
                fs::remove_file(path)
            } else {
                Ok(())
            }
        })
}

#[cfg(test)]
mod tests {
    use std::{
        fs::{self, File},
        thread,
        time::{Duration, SystemTime},
    };

    use super::cleanup_dir;

    #[test]
    fn test_cleanup_dir() {
        // Create temporary directory with some entries
        let tempdir = tempfile::tempdir().unwrap();
        let temp_path = tempdir.path();

        let dir = temp_path.join("dir");
        fs::create_dir(&dir).unwrap();
        let sub_file = dir.join("sub_file");
        _ = File::create(&sub_file).unwrap();
        let file = temp_path.join("file");
        _ = File::create(&file).unwrap();

        let entries = [dir, sub_file, file];

        // Make sure there differences in modification time and current time.
        thread::sleep(Duration::from_millis(50));

        // Cleaning up with time stamp one day ago must not remove anything.
        let past = SystemTime::now()
            .checked_sub(Duration::from_secs(3600))
            .unwrap();
        cleanup_dir(&temp_path, past).unwrap();
        for entry in &entries {
            assert!(entry.exists());
        }

        // Cleaning up with now must remove all files and directories.
        cleanup_dir(&temp_path, SystemTime::now()).unwrap();

        // Temp directory itself shouldn't be removed.
        assert!(temp_path.exists());

        for entry in entries {
            assert!(!entry.exists());
        }
    }
}
