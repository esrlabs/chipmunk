use crate::*;
use std::{ffi::OsStr, fs::Metadata};
use walkdir::DirEntry;

impl FolderEntityDetails {
    /// Creates a `FolderEntityDetails` instance from a directory entry.
    ///
    /// # Parameters
    /// - `entity`: The `DirEntry` representing a file or folder.
    ///
    /// # Returns
    /// - `Some(FolderEntityDetails)` if the parent directory can be determined.
    /// - `None` otherwise.
    pub fn from(entity: &DirEntry) -> Option<FolderEntityDetails> {
        entity.path().parent().map(|parent| FolderEntityDetails {
            full: entity.path().to_string_lossy().to_string(),
            filename: entity.file_name().to_string_lossy().to_string(),
            path: parent.to_string_lossy().to_string(),
            basename: entity.file_name().to_string_lossy().to_string(),
            ext: entity
                .path()
                .extension()
                .unwrap_or(OsStr::new(""))
                .to_string_lossy()
                .to_string(),
        })
    }
}

impl FolderEntity {
    /// Creates a `FolderEntity` instance from a directory entry and its metadata.
    ///
    /// # Parameters
    /// - `entity`: The `DirEntry` representing a file or folder.
    /// - `md`: The `Metadata` of the directory entry.
    ///
    /// # Returns
    /// - `Some(FolderEntity)` if the entry is a directory, file, or symbolic link.
    /// - `None` otherwise.
    pub fn from(entity: &DirEntry, md: &Metadata) -> Option<FolderEntity> {
        if md.is_dir() {
            FolderEntity::dir(entity)
        } else if md.is_symlink() {
            FolderEntity::symlink(entity)
        } else {
            FolderEntity::file(entity)
        }
    }

    /// Creates a `FolderEntity` instance for a directory.
    ///
    /// # Parameters
    /// - `entity`: The `DirEntry` representing the directory.
    ///
    /// # Returns
    /// - `Some(FolderEntity)` if the directory has a valid file name.
    /// - `None` otherwise.
    fn dir(entity: &DirEntry) -> Option<FolderEntity> {
        entity.path().file_name().map(|filename| FolderEntity {
            name: filename.to_string_lossy().to_string(),
            fullname: entity.path().to_string_lossy().to_string(),
            kind: FolderEntityType::Directory,
            details: None,
        })
    }

    /// Creates a `FolderEntity` instance for a file.
    ///
    /// # Parameters
    /// - `entity`: The `DirEntry` representing the file.
    ///
    /// # Returns
    /// - `Some(FolderEntity)` if the file has a valid file name.
    /// - `None` otherwise.
    fn file(entity: &DirEntry) -> Option<FolderEntity> {
        entity.path().file_name().map(|filename| FolderEntity {
            name: filename.to_string_lossy().to_string(),
            fullname: entity.path().to_string_lossy().to_string(),
            kind: FolderEntityType::File,
            details: FolderEntityDetails::from(entity),
        })
    }

    /// Creates a `FolderEntity` instance for a symbolic link.
    ///
    /// # Parameters
    /// - `entity`: The `DirEntry` representing the symbolic link.
    ///
    /// # Returns
    /// - `Some(FolderEntity)` if the symbolic link has a valid file name.
    /// - `None` otherwise.
    fn symlink(entity: &DirEntry) -> Option<FolderEntity> {
        entity.path().file_name().map(|filename| FolderEntity {
            name: filename.to_string_lossy().to_string(),
            fullname: entity.path().to_string_lossy().to_string(),
            kind: FolderEntityType::SymbolicLink,
            details: FolderEntityDetails::from(entity),
        })
    }
}
