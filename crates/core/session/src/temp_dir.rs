//! Ownership of the temp directory one running instance writes its session files to.
//!
//! An instance locks `inst-<id>.lock` and keeps its files in the sibling `inst-<id>/`; both are
//! removed when [`InstanceTempDir`] is dropped. [`InstanceTempDir::sweep_leftovers`] exists only
//! for abnormal exits: the OS releases the lock when the owning process dies, so another instance
//! can prove a leftover directory is orphaned instead of guessing from modification times.

use std::{
    fs::{self, File, OpenOptions, TryLockError},
    io,
    path::{Path, PathBuf},
    time::SystemTime,
};

use log::{debug, warn};
use uuid::Uuid;

use crate::paths;

/// Marks the lock file and the directory of one instance within the streams directory.
const INSTANCE_PREFIX: &str = "inst-";
const LOCK_EXTENSION: &str = "lock";

/// Temp directory of one running instance, removed with its content once dropped.
///
/// Everything writing into the directory must keep a reference to this value, since the directory
/// lives exactly as long as the last owner of it.
#[derive(Debug)]
pub struct InstanceTempDir {
    /// Streams directory holding the directories of all instances.
    root: PathBuf,
    /// The path of the temp directory for the running instance.
    path: PathBuf,
    /// `None` when the lock couldn't be acquired, so `path` is the shared streams directory
    /// itself, never removed, with leftovers reclaimed by age only.
    lock: Option<InstanceLock>,
}

/// Lock file proving that the owner of an instance directory is still running.
#[derive(Debug)]
struct InstanceLock {
    path: PathBuf,
    /// Kept open for the instance's lifetime; never locked again on this handle, since relocking
    /// is platform specific.
    file: File,
}

impl InstanceTempDir {
    /// Claims a directory within Chipmunk's streams directory.
    pub fn in_streams_dir() -> Result<Self, stypes::NativeError> {
        let streams_dir = paths::get_streams_dir()?;

        let instance = Self::claim(&streams_dir);

        Ok(instance)
    }

    /// Claims a directory within `root`, falling back to `root` itself when the lock can't be
    /// acquired, e.g. on filesystems without locking support.
    pub fn claim(root: &Path) -> Self {
        match Self::try_claim(root) {
            Ok(temp_dir) => temp_dir,
            Err(err) => {
                warn!(
                    "Claiming an instance directory in {} failed: {err}. Temp files of this run \
                     stay in the streams directory and are cleaned up by age only.",
                    root.display()
                );

                Self {
                    root: root.to_path_buf(),
                    path: root.to_path_buf(),
                    lock: None,
                }
            }
        }
    }

    /// Directory to write session files and other temp sources of this instance to.
    pub fn path(&self) -> &Path {
        &self.path
    }

    /// Removes leftovers of other instances: directories whose lock proves the owner is gone,
    /// plus entries outside the instance layout which were modified before `stale_before`.
    pub fn sweep_leftovers(&self, stale_before: SystemTime) -> io::Result<()> {
        let own_lock = self.lock.as_ref().map(|lock| lock.path.as_path());

        sweep_dir(&self.root, own_lock, stale_before)
    }

    fn try_claim(root: &Path) -> io::Result<Self> {
        let id = Uuid::new_v4();
        let lock_path = root.join(format!("{INSTANCE_PREFIX}{id}.{LOCK_EXTENSION}"));
        let file = OpenOptions::new()
            .read(true)
            .write(true)
            .create(true)
            .truncate(false)
            .open(&lock_path)?;

        // Lock before creating the directory: a sweeper only removes directories whose lock it
        // could acquire, so there is no moment in which ours looks orphaned.
        file.try_lock().map_err(|err| match err {
            TryLockError::Error(err) => err,
            TryLockError::WouldBlock => {
                io::Error::other(format!("lock {} is already held", lock_path.display()))
            }
        })?;

        let path = root.join(format!("{INSTANCE_PREFIX}{id}"));
        fs::create_dir(&path)?;
        debug!("Instance directory claimed: {}", path.display());

        let lock = InstanceLock {
            path: lock_path,
            file,
        };
        let instance = Self {
            root: root.to_path_buf(),
            path,
            lock: Some(lock),
        };

        Ok(instance)
    }
}

impl Drop for InstanceTempDir {
    fn drop(&mut self) {
        // Without a lock the directory is the shared streams directory, which is not ours.
        let Some(lock) = self.lock.take() else {
            return;
        };

        debug!("Removing instance directory: {}", self.path.display());
        // Session files and attachments are already removed one by one when their session closes,
        // so this is normally an empty tree.
        remove_entry(&self.path);

        // Close first; Windows refuses to remove a locked file.
        drop(lock.file);
        remove_entry(&lock.path);
    }
}

/// Removes orphaned instance directories and stale entries of the flat layout within `dir`.
///
/// `own_lock` is the lock file of the sweeping instance, which must be skipped instead of probed.
fn sweep_dir(dir: &Path, own_lock: Option<&Path>, stale_before: SystemTime) -> io::Result<()> {
    if !dir.exists() {
        return Ok(());
    }

    for entry in fs::read_dir(dir)?.flatten() {
        let path = entry.path();
        if is_lock_file(&path) {
            // Probing our own lock would only prove that this process is alive.
            if own_lock.is_some_and(|own| own == path) {
                continue;
            }

            // A lock left behind by the probe may only be reclaimed by age once it guards
            // nothing: a live instance's lock still has its directory next to it.
            if !reclaim_if_orphan(&path)
                && !guarded_dir(&path).exists()
                && is_stale(&entry, stale_before)
            {
                remove_entry(&path);
            }
            continue;
        }

        // Entries no lock can decide about fall back to the age rule: legacy flat layout and
        // runs without locking support.
        if lock_path_of(&path).is_none_or(|lock| !lock.exists()) && is_stale(&entry, stale_before) {
            remove_entry(&path);
        }
    }

    Ok(())
}

/// Removes the instance directory guarded by `lock_path` when its lock can be acquired, which
/// proves the owning process is gone.
///
/// Returns `true` when this lock and the directory it guarded are gone, and `false` when either
/// survived, be it because a live instance holds the lock, because the lock couldn't be probed at
/// all, or because removing the directory failed.
fn reclaim_if_orphan(lock_path: &Path) -> bool {
    let lock = match OpenOptions::new().read(true).write(true).open(lock_path) {
        Ok(file) => file,
        // Another sweeper may have reclaimed this instance in the meantime.
        Err(err) if err.kind() == io::ErrorKind::NotFound => return true,
        Err(err) => {
            warn!("Opening lock {} failed: {err}", lock_path.display());
            return false;
        }
    };

    match lock.try_lock() {
        Ok(()) => {}
        // The lock is held, so a live instance owns this directory.
        Err(TryLockError::WouldBlock) => return false,
        Err(TryLockError::Error(err)) => {
            warn!("Probing lock {} failed: {err}", lock_path.display());
            return false;
        }
    }

    debug!("Reclaiming leftovers of instance {}", lock_path.display());
    // Keep the lock when its directory survived: the next sweep probes it again and retries,
    // instead of leaving the directory unguarded and reclaimable by age only.
    if !remove_entry(&guarded_dir(lock_path)) {
        return false;
    }

    // Unlock and close first; Windows refuses to remove a locked file.
    if let Err(err) = lock.unlock() {
        warn!("Unlocking {} failed: {err}", lock_path.display());
    }
    drop(lock);
    remove_entry(lock_path);

    true
}

fn is_lock_file(path: &Path) -> bool {
    has_instance_prefix(path) && path.extension().is_some_and(|ext| ext == LOCK_EXTENSION)
}

/// Lock file guarding the given entry, or `None` when the entry isn't part of the instance
/// layout.
fn lock_path_of(entry: &Path) -> Option<PathBuf> {
    has_instance_prefix(entry).then(|| entry.with_extension(LOCK_EXTENSION))
}

/// Instance directory the given lock file guards.
fn guarded_dir(lock_path: &Path) -> PathBuf {
    lock_path.with_extension("")
}

fn has_instance_prefix(path: &Path) -> bool {
    path.file_name()
        .and_then(|name| name.to_str())
        .is_some_and(|name| name.starts_with(INSTANCE_PREFIX))
}

fn is_stale(entry: &fs::DirEntry, stale_before: SystemTime) -> bool {
    entry.metadata().is_ok_and(|meta| {
        meta.modified()
            .is_ok_and(|modified| modified < stale_before)
    })
}

/// Removes a file or directory tree and reports whether it is gone, logging failures instead of
/// stopping the sweep or panicking on drop.
fn remove_entry(path: &Path) -> bool {
    let removed = if path.is_dir() {
        fs::remove_dir_all(path)
    } else {
        fs::remove_file(path)
    };

    match removed {
        Ok(()) => true,
        Err(err) if err.kind() == io::ErrorKind::NotFound => true,
        Err(err) => {
            warn!("Removing leftover {} failed: {err}", path.display());
            false
        }
    }
}

#[cfg(test)]
mod tests {
    use std::{
        fs::{self, File},
        path::{Path, PathBuf},
        time::{Duration, SystemTime},
    };

    use super::{InstanceTempDir, sweep_dir};

    /// Time limit that makes every freshly created entry count as stale.
    fn everything_stale() -> SystemTime {
        SystemTime::now()
            .checked_add(Duration::from_secs(60))
            .unwrap()
    }

    /// Time limit that makes no entry count as stale.
    fn nothing_stale() -> SystemTime {
        SystemTime::now()
            .checked_sub(Duration::from_secs(60))
            .unwrap()
    }

    /// Creates the layout of an instance which is no longer running.
    fn leftover_instance(root: &Path, id: &str) -> (PathBuf, PathBuf) {
        let lock = root.join(format!("inst-{id}.lock"));
        File::create(&lock).unwrap();
        let dir = root.join(format!("inst-{id}"));
        fs::create_dir(&dir).unwrap();
        File::create(dir.join("session.session")).unwrap();

        (lock, dir)
    }

    #[test]
    fn drop_removes_own_directory_and_lock() {
        let temp = tempfile::tempdir().unwrap();
        let temp_dir = InstanceTempDir::claim(temp.path());
        File::create(temp_dir.path().join("session.session")).unwrap();

        drop(temp_dir);

        assert_eq!(
            fs::read_dir(temp.path()).unwrap().count(),
            0,
            "neither the directory nor the lock file may survive the instance"
        );
    }

    #[test]
    fn sweep_reclaims_orphan_instance() {
        let temp = tempfile::tempdir().unwrap();
        let temp_dir = InstanceTempDir::claim(temp.path());
        let (lock, dir) = leftover_instance(temp.path(), "gone");

        temp_dir.sweep_leftovers(nothing_stale()).unwrap();

        assert!(!dir.exists(), "orphaned directory must be removed");
        assert!(!lock.exists(), "orphaned lock file must be removed");
        assert!(temp_dir.path().exists(), "own directory must survive");
    }

    #[test]
    fn sweep_keeps_locked_instance() {
        let temp = tempfile::tempdir().unwrap();
        let live = InstanceTempDir::claim(temp.path());
        let dir = live.path().to_path_buf();
        File::create(dir.join("session.session")).unwrap();

        // Sweeping without knowing the lock is ours is what another instance does: the held lock
        // alone must protect the directory.
        sweep_dir(temp.path(), None, everything_stale()).unwrap();

        assert!(dir.exists(), "live instance directory must survive");
        drop(live);
    }

    #[test]
    fn sweep_removes_stale_entries_of_flat_layout() {
        let temp = tempfile::tempdir().unwrap();
        let session = temp.path().join("some-uuid.session");
        File::create(&session).unwrap();
        let attachments = temp.path().join("some-uuid");
        fs::create_dir(&attachments).unwrap();
        File::create(attachments.join("attachment.txt")).unwrap();

        sweep_dir(temp.path(), None, nothing_stale()).unwrap();
        assert!(session.exists(), "fresh entries must survive");
        assert!(attachments.exists(), "fresh entries must survive");

        sweep_dir(temp.path(), None, everything_stale()).unwrap();
        assert!(!session.exists());
        assert!(!attachments.exists());
        assert!(temp.path().exists(), "the swept directory itself must stay");
    }

    #[test]
    fn sweep_ages_out_instance_directory_without_lock() {
        let temp = tempfile::tempdir().unwrap();
        let dir = temp.path().join("inst-lockless");
        fs::create_dir(&dir).unwrap();

        sweep_dir(temp.path(), None, nothing_stale()).unwrap();
        assert!(dir.exists());

        sweep_dir(temp.path(), None, everything_stale()).unwrap();
        assert!(!dir.exists());
    }
}
