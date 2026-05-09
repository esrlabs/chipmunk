//! File-explorer storage I/O.

use std::{
    fs::File,
    io::{BufReader, BufWriter},
    path::{Path, PathBuf},
};

use log::{trace, warn};
use serde::{Deserialize, Serialize};
use tokio::sync::mpsc;

use super::storage_path;
use crate::host::{
    service::HostAsyncEvent,
    ui::storage::{
        FavoriteFolder, FileExplorerData, FileTreeNode, FileTreeNodeKind, StorageError,
        StorageErrorKind, StorageEvent,
    },
};

const FILE_EXPLORER_FILE: &str = "file_explorer.json";
const FAVORITE_SCAN_MAX_DEPTH: usize = 5;
pub const FAVORITE_SCAN_MAX_ENTRIES: usize = 20_000;

/// Path-only file-explorer schema stored on disk.
#[derive(Debug, Default, Serialize, Deserialize)]
struct PersistedFileExplorerData {
    favorite_folders: Vec<PathBuf>,
}

impl From<&FileExplorerData> for PersistedFileExplorerData {
    fn from(data: &FileExplorerData) -> Self {
        Self {
            favorite_folders: data
                .favorite_folders
                .iter()
                .map(|folder| folder.path.clone())
                .collect(),
        }
    }
}

/// Starts the background load for file-explorer storage and publishes the result.
pub fn spawn_load(event_tx: mpsc::Sender<HostAsyncEvent>) {
    tokio::task::spawn_blocking(move || {
        let result = get_path().and_then(|path| load(&path));

        match result {
            Ok(data) => {
                let favorite_folders = scan_favorite_folders(&data.favorite_folders, &event_tx);
                let data = FileExplorerData { favorite_folders };
                _ = event_tx.blocking_send(HostAsyncEvent::Storage(
                    StorageEvent::FileExplorerLoaded(Ok(Box::new(data))),
                ));
            }
            Err(err) => {
                _ = event_tx.blocking_send(HostAsyncEvent::Storage(
                    StorageEvent::FileExplorerLoaded(Err(err)),
                ));
            }
        }
    });
}

/// Loads the persisted favorite-folder paths from disk.
fn load(path: &Path) -> Result<PersistedFileExplorerData, StorageError> {
    let file = match File::open(path) {
        Ok(file) => file,
        Err(err) if err.kind() == std::io::ErrorKind::NotFound => {
            trace!(
                "File-explorer storage file does not exist: {}",
                path.display()
            );
            return Ok(PersistedFileExplorerData::default());
        }
        Err(err) => {
            warn!(
                "Failed to read file-explorer storage from {}: {err}",
                path.display()
            );
            return Err(StorageError {
                kind: StorageErrorKind::Read,
                message: format!("Failed to read '{}': {err}", path.display()),
            });
        }
    };

    let reader = BufReader::new(file);
    serde_json::from_reader::<_, PersistedFileExplorerData>(reader).map_err(|err| {
        warn!(
            "Failed to parse file-explorer storage from {}: {err}",
            path.display()
        );

        StorageError {
            kind: StorageErrorKind::Parse,
            message: format!("Failed to parse '{}': {err}", path.display()),
        }
    })
}

/// Scans the provided favorite folders and returns runtime tree snapshots.
pub fn scan_favorite_folders(
    paths: &[PathBuf],
    event_tx: &mpsc::Sender<HostAsyncEvent>,
) -> Vec<FavoriteFolder> {
    scan_favorite_folders_with_limit(paths, FAVORITE_SCAN_MAX_ENTRIES, event_tx)
}

fn scan_favorite_folders_with_limit(
    paths: &[PathBuf],
    max_entries: usize,
    event_tx: &mpsc::Sender<HostAsyncEvent>,
) -> Vec<FavoriteFolder> {
    let mut favorite_folders = Vec::with_capacity(paths.len());
    let mut limited_folder_names = Vec::new();

    for path in paths {
        let mut remaining_entries = max_entries;
        favorite_folders.push(scan_folder(path, &mut remaining_entries));
        if remaining_entries == 0 {
            limited_folder_names.push(
                path.file_name()
                    .map(|name| name.to_string_lossy().into_owned())
                    .unwrap_or_else(|| path.to_string_lossy().into_owned()),
            );
        }
    }

    if !limited_folder_names.is_empty()
        && event_tx
            .blocking_send(HostAsyncEvent::Storage(
                StorageEvent::FavoriteFolderLimitReached {
                    folder_names: limited_folder_names,
                    max_entries_count: max_entries,
                },
            ))
            .is_err()
    {
        warn!("Failed to send favorite-folder scan limit warning");
    }

    favorite_folders
}

/// Persists the file-explorer domain to its storage file.
pub fn save(data: &FileExplorerData) -> Result<(), StorageError> {
    let path = get_path()?;
    let persist_data = PersistedFileExplorerData::from(data);
    save_to_path(&path, &persist_data)
}

/// Writes the file-explorer snapshot to the provided path.
fn save_to_path(path: &Path, data: &PersistedFileExplorerData) -> Result<(), StorageError> {
    let file = File::create(path).map_err(|err| StorageError {
        kind: StorageErrorKind::Write,
        message: format!("Failed to write '{}': {err}", path.display()),
    })?;

    serde_json::to_writer_pretty(BufWriter::new(file), data).map_err(|err| StorageError {
        kind: StorageErrorKind::Write,
        message: format!("Failed to serialize '{}': {err}", path.display()),
    })
}

/// Resolves the file-explorer storage file path under the shared storage directory.
fn get_path() -> Result<PathBuf, StorageError> {
    storage_path().map(|storage_dir| storage_dir.join(FILE_EXPLORER_FILE))
}

fn scan_folder(path: &Path, remaining_entries: &mut usize) -> FavoriteFolder {
    let mut folder = FavoriteFolder::new(path.to_owned());

    let metadata = match std::fs::symlink_metadata(path) {
        Ok(metadata) => metadata,
        Err(err) => {
            warn!(
                "Failed to read metadata for favorite folder {}: {err}",
                path.display()
            );
            return folder;
        }
    };

    if metadata.file_type().is_symlink() || !metadata.is_dir() {
        return folder;
    }

    folder.children = scan_children(path, 0, remaining_entries);
    folder
}

fn scan_children(
    path: &Path,
    parent_depth: usize,
    remaining_entries: &mut usize,
) -> Vec<FileTreeNode> {
    if *remaining_entries == 0 {
        return Vec::new();
    }

    let entries = match std::fs::read_dir(path) {
        Ok(entries) => entries,
        Err(err) => {
            warn!("Failed to scan favorite folder {}: {err}", path.display());
            return Vec::new();
        }
    };

    let child_depth = parent_depth + 1;
    let mut children = Vec::new();

    for entry in entries {
        if *remaining_entries == 0 {
            break;
        }

        let entry = match entry {
            Ok(entry) => entry,
            Err(err) => {
                warn!(
                    "Failed to read an entry in favorite folder {}: {err}",
                    path.display()
                );
                continue;
            }
        };

        let entry_path = entry.path();
        let metadata = match std::fs::symlink_metadata(&entry_path) {
            Ok(metadata) => metadata,
            Err(err) => {
                warn!(
                    "Failed to read metadata for {} while scanning favorite folder {}: {err}",
                    entry_path.display(),
                    path.display()
                );
                continue;
            }
        };

        let file_type = metadata.file_type();
        if file_type.is_symlink() {
            continue;
        }

        let kind = if file_type.is_dir() {
            if child_depth >= FAVORITE_SCAN_MAX_DEPTH {
                continue;
            }
            *remaining_entries -= 1;
            FileTreeNodeKind::Folder(scan_children(&entry_path, child_depth, remaining_entries))
        } else if file_type.is_file() {
            if child_depth > FAVORITE_SCAN_MAX_DEPTH {
                continue;
            }
            *remaining_entries -= 1;
            FileTreeNodeKind::File
        } else {
            continue;
        };

        children.push(FileTreeNode {
            path: entry_path,
            name: entry.file_name().to_string_lossy().into_owned(),
            kind,
        });
    }

    sort_tree_nodes(&mut children);
    children
}

fn sort_tree_nodes(nodes: &mut [FileTreeNode]) {
    nodes.sort_unstable_by(|left, right| {
        tree_node_kind_rank(&left.kind)
            .cmp(&tree_node_kind_rank(&right.kind))
            .then_with(|| left.name.cmp(&right.name))
    });
}

fn tree_node_kind_rank(kind: &FileTreeNodeKind) -> u8 {
    match kind {
        FileTreeNodeKind::Folder(_) => 0,
        FileTreeNodeKind::File => 1,
    }
}

#[cfg(test)]
mod tests {
    use std::{
        fs,
        path::{Path, PathBuf},
        sync::atomic::{AtomicU64, Ordering},
        time::{SystemTime, UNIX_EPOCH},
    };

    use tokio::sync::mpsc;

    use crate::host::service::{HostAsyncEvent, storage::storage_path_from_home};
    use crate::host::ui::storage::{
        FavoriteFolder, FileExplorerData, FileTreeNode, FileTreeNodeKind, StorageError,
        StorageErrorKind, StorageEvent,
    };

    use super::{
        FAVORITE_SCAN_MAX_ENTRIES, FILE_EXPLORER_FILE, PersistedFileExplorerData, load,
        save_to_path, scan_favorite_folders_with_limit,
    };

    static NEXT_TEST_DIR_ID: AtomicU64 = AtomicU64::new(0);

    fn test_home_dir() -> PathBuf {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system time must be after unix epoch")
            .as_nanos();
        let id = NEXT_TEST_DIR_ID.fetch_add(1, Ordering::Relaxed);
        let path = std::env::temp_dir().join(format!("chipmunk-file-explorer-test-{unique}-{id}"));
        fs::create_dir_all(&path).expect("temp test home dir should be created");
        path
    }

    fn path_from_home(home_dir: &Path) -> Result<PathBuf, StorageError> {
        let storage_dir = storage_path_from_home(home_dir)?;
        Ok(storage_dir.join(FILE_EXPLORER_FILE))
    }

    fn persisted_data(paths: &[PathBuf]) -> PersistedFileExplorerData {
        PersistedFileExplorerData {
            favorite_folders: paths.to_vec(),
        }
    }

    fn file_node(path: PathBuf, name: &str) -> FileTreeNode {
        FileTreeNode {
            path,
            name: name.into(),
            kind: FileTreeNodeKind::File,
        }
    }

    fn child_names(nodes: &[FileTreeNode]) -> Vec<&str> {
        nodes.iter().map(|node| node.name.as_str()).collect()
    }

    fn folder_children<'a>(nodes: &'a [FileTreeNode], name: &str) -> &'a [FileTreeNode] {
        let node = nodes
            .iter()
            .find(|node| node.name == name)
            .unwrap_or_else(|| panic!("folder {name} should exist"));

        let FileTreeNodeKind::Folder(children) = &node.kind else {
            panic!("{name} should be a folder");
        };

        children
    }

    fn scan(paths: &[PathBuf]) -> Vec<FavoriteFolder> {
        let (event_tx, _event_rx) = mpsc::channel(1);
        scan_favorite_folders_with_limit(paths, FAVORITE_SCAN_MAX_ENTRIES, &event_tx)
    }

    fn scan_with_limit(paths: &[PathBuf], max_entries: usize) -> Vec<FavoriteFolder> {
        let (event_tx, _event_rx) = mpsc::channel(1);
        scan_favorite_folders_with_limit(paths, max_entries, &event_tx)
    }

    #[test]
    fn missing_file_defaults() {
        let home_dir = test_home_dir();
        let path = path_from_home(&home_dir).expect("path should resolve");

        let data = load(&path).expect("missing file should default");

        assert!(data.favorite_folders.is_empty());
        let _ = fs::remove_dir_all(home_dir);
    }

    #[test]
    fn malformed_json_fails() {
        let home_dir = test_home_dir();
        let path = path_from_home(&home_dir).expect("path should resolve");
        fs::write(&path, "{not-json").expect("invalid json should be written");

        let err = load(&path).expect_err("invalid json should fail");

        assert_eq!(err.kind, StorageErrorKind::Parse);
        let _ = fs::remove_dir_all(home_dir);
    }

    #[test]
    fn save_skips_scanned_tree() {
        let home_dir = test_home_dir();
        let path = path_from_home(&home_dir).expect("path should resolve");
        let mut runtime = FileExplorerData {
            favorite_folders: vec![FavoriteFolder::new(PathBuf::from("/tmp/favorites"))],
        };
        runtime.favorite_folders[0].children.push(file_node(
            PathBuf::from("/tmp/favorites/visible.log"),
            "visible.log",
        ));

        save_to_path(&path, &PersistedFileExplorerData::from(&runtime))
            .expect("save should succeed");
        let loaded = load(&path).expect("saved file should be readable");

        assert_eq!(
            loaded.favorite_folders,
            vec![PathBuf::from("/tmp/favorites")]
        );
        let _ = fs::remove_dir_all(home_dir);
    }

    #[test]
    fn load_reads_path_only_shape() {
        let home_dir = test_home_dir();
        let path = path_from_home(&home_dir).expect("path should resolve");

        save_to_path(
            &path,
            &persisted_data(&[PathBuf::from("/tmp/one"), PathBuf::from("/tmp/two")]),
        )
        .expect("save should succeed");

        let loaded = load(&path).expect("saved file should reload");

        assert_eq!(
            loaded.favorite_folders,
            vec![PathBuf::from("/tmp/one"), PathBuf::from("/tmp/two")]
        );
        let _ = fs::remove_dir_all(home_dir);
    }

    #[test]
    fn scan_includes_nested_content_and_hidden_files() {
        let dir = test_home_dir();
        let nested_dir = dir.join("nested");
        fs::create_dir(&nested_dir).expect("nested dir should be created");
        fs::write(dir.join("visible.log"), "hello").expect("visible file should be written");
        fs::write(dir.join(".hidden.log"), "secret").expect("hidden file should be written");
        fs::write(nested_dir.join("nested.log"), "nested").expect("nested file should be written");

        let scanned = scan(std::slice::from_ref(&dir));

        assert_eq!(scanned.len(), 1);
        assert_eq!(scanned[0].path, dir);
        assert_eq!(
            child_names(&scanned[0].children),
            vec!["nested", ".hidden.log", "visible.log"]
        );
        assert_eq!(
            child_names(folder_children(&scanned[0].children, "nested")),
            vec!["nested.log"]
        );

        let _ = fs::remove_dir_all(scanned[0].path.clone());
    }

    #[cfg(unix)]
    #[test]
    fn scan_skips_symlinks() {
        use std::os::unix::fs::symlink;

        let dir = test_home_dir();
        let visible = dir.join("visible.log");
        let symlink_path = dir.join("linked.log");

        fs::write(&visible, "hello").expect("visible file should be written");
        symlink(&visible, &symlink_path).expect("symlink should be created");

        let scanned = scan(std::slice::from_ref(&dir));

        assert_eq!(child_names(&scanned[0].children), vec!["visible.log"]);

        let _ = fs::remove_dir_all(scanned[0].path.clone());
    }

    #[test]
    fn scan_applies_limit_per_root() {
        let first = test_home_dir();
        let second = test_home_dir();
        let counted_folder = first.join("counted_folder");
        fs::create_dir(&counted_folder).expect("folder should be created");
        fs::write(counted_folder.join("nested.log"), "nested")
            .expect("nested file should be written");
        fs::write(second.join("second.log"), "second").expect("second file should be written");

        let scanned = scan_with_limit(&[first.clone(), second.clone()], 1);

        assert_eq!(child_names(&scanned[0].children), vec!["counted_folder"]);
        assert!(folder_children(&scanned[0].children, "counted_folder").is_empty());
        assert_eq!(child_names(&scanned[1].children), vec!["second.log"]);

        let _ = fs::remove_dir_all(first);
        let _ = fs::remove_dir_all(second);
    }

    #[test]
    fn scan_limit_sends_one_warning_with_folder_names() {
        let first = test_home_dir();
        let second = test_home_dir();
        fs::write(first.join("first.log"), "first").expect("first file should be written");
        fs::write(second.join("second.log"), "second").expect("second file should be written");

        let (event_tx, mut event_rx) = mpsc::channel(1);
        let scanned =
            scan_favorite_folders_with_limit(&[first.clone(), second.clone()], 1, &event_tx);

        assert_eq!(child_names(&scanned[0].children), vec!["first.log"]);
        assert_eq!(child_names(&scanned[1].children), vec!["second.log"]);
        assert!(matches!(
            event_rx.try_recv(),
            Ok(HostAsyncEvent::Storage(
                StorageEvent::FavoriteFolderLimitReached {
                    folder_names,
                    max_entries_count: 1,
                }
            )) if folder_names == vec![
                first.file_name().unwrap().to_string_lossy().into_owned(),
                second.file_name().unwrap().to_string_lossy().into_owned(),
            ]
        ));
        assert!(event_rx.try_recv().is_err());

        let _ = fs::remove_dir_all(first);
        let _ = fs::remove_dir_all(second);
    }

    #[test]
    fn scan_sorts_folders_before_files_by_name() {
        let dir = test_home_dir();
        fs::create_dir(dir.join("b_folder")).expect("folder should be created");
        fs::create_dir(dir.join("a_folder")).expect("folder should be created");
        fs::write(dir.join("b.log"), "b").expect("file should be written");
        fs::write(dir.join("a.log"), "a").expect("file should be written");

        let scanned = scan(std::slice::from_ref(&dir));

        assert_eq!(
            child_names(&scanned[0].children),
            vec!["a_folder", "b_folder", "a.log", "b.log"]
        );

        let _ = fs::remove_dir_all(scanned[0].path.clone());
    }

    #[test]
    fn missing_folder_returns_empty_snapshot() {
        let home_dir = test_home_dir();
        let missing = home_dir.join("missing");
        let scanned = scan(std::slice::from_ref(&missing));

        assert_eq!(scanned.len(), 1);
        assert_eq!(scanned[0].path, missing);
        assert!(scanned[0].children.is_empty());

        let _ = fs::remove_dir_all(home_dir);
    }

    #[test]
    fn folders_at_max_depth_are_not_shown_as_empty() {
        let dir = test_home_dir();
        let d1 = dir.join("d1");
        let d2 = d1.join("d2");
        let d3 = d2.join("d3");
        let d4 = d3.join("d4");
        let d5 = d4.join("d5");
        fs::create_dir_all(&d5).expect("deep folders should be created");
        fs::write(d4.join("depth5.log"), "depth 5").expect("depth 5 file should be written");
        fs::write(d5.join("too-deep.log"), "too deep").expect("too deep file should be written");

        let scanned = scan(std::slice::from_ref(&dir));
        let d1_children = folder_children(&scanned[0].children, "d1");
        let d2_children = folder_children(d1_children, "d2");
        let d3_children = folder_children(d2_children, "d3");
        let d4_children = folder_children(d3_children, "d4");

        assert_eq!(child_names(d4_children), vec!["depth5.log"]);

        let _ = fs::remove_dir_all(scanned[0].path.clone());
    }
}
