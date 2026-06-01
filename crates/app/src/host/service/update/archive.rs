//! Portable archive extraction helpers for built-in app updates.

use std::{
    fs::{self, File},
    path::{Component, Path, PathBuf},
};

use anyhow::{Context, bail, ensure};
use flate2::read::GzDecoder;
use tar::Archive;

/// Unpacks a portable archive while rejecting entries that could escape the destination.
pub fn unpack_archive(archive_path: &Path, destination: &Path) -> anyhow::Result<()> {
    let archive_file = File::open(archive_path)
        .with_context(|| format!("failed to open update archive '{}'", archive_path.display()))?;
    let decoder = GzDecoder::new(archive_file);
    let mut archive = Archive::new(decoder);

    for entry in archive.entries().context("failed to read update archive")? {
        let mut entry = entry.context("failed to read update archive entry")?;
        let entry_type = entry.header().entry_type();
        ensure!(
            entry_type.is_file() || entry_type.is_dir(),
            "update archive contains an unsupported entry type"
        );

        let entry_path = entry.path().context("failed to read update archive path")?;
        let safe_path = safe_archive_path(&entry_path)?;
        let destination_path = destination.join(safe_path);
        if entry_type.is_file()
            && let Some(parent) = destination_path.parent()
        {
            fs::create_dir_all(parent).context("failed to prepare update archive entry parent")?;
        }
        entry
            .unpack(destination_path)
            .context("failed to unpack update archive entry")?;
    }

    Ok(())
}

/// Converts a tar entry path into a destination-relative path.
fn safe_archive_path(path: &Path) -> anyhow::Result<PathBuf> {
    let mut safe_path = PathBuf::new();
    for component in path.components() {
        match component {
            Component::Normal(part) => safe_path.push(part),
            Component::CurDir => {}
            Component::ParentDir | Component::RootDir | Component::Prefix(_) => {
                bail!("update archive contains an unsafe path");
            }
        }
    }

    ensure!(
        !safe_path.as_os_str().is_empty(),
        "update archive contains an unsafe path"
    );

    Ok(safe_path)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn safe_path_rejects_parent_traversal() {
        assert!(safe_archive_path(Path::new("../chipmunk")).is_err());
        assert!(safe_archive_path(Path::new("bin/../../chipmunk")).is_err());
    }

    #[test]
    fn safe_path_rejects_absolute_paths() {
        assert!(safe_archive_path(Path::new("/tmp/chipmunk")).is_err());
    }

    #[test]
    fn safe_path_accepts_relative_paths() {
        let path = safe_archive_path(Path::new("./bin/chipmunk")).unwrap();

        assert_eq!(path, PathBuf::from("bin/chipmunk"));
    }
}
