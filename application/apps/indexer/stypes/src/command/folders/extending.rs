use crate::*;
use std::{ffi::OsStr, fs::Metadata};
use walkdir::DirEntry;

impl FolderEntityDetails {
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
    pub fn from(entity: &DirEntry, md: &Metadata) -> Option<FolderEntity> {
        if md.is_dir() {
            FolderEntity::dir(entity)
        } else if md.is_symlink() {
            FolderEntity::symlink(entity)
        } else {
            FolderEntity::file(entity)
        }
    }

    fn dir(entity: &DirEntry) -> Option<FolderEntity> {
        entity.path().file_name().map(|filename| FolderEntity {
            name: filename.to_string_lossy().to_string(),
            fullname: entity.path().to_string_lossy().to_string(),
            kind: FolderEntityType::Directory,
            details: None,
        })
    }

    fn file(entity: &DirEntry) -> Option<FolderEntity> {
        entity.path().file_name().map(|filename| FolderEntity {
            name: filename.to_string_lossy().to_string(),
            fullname: entity.path().to_string_lossy().to_string(),
            kind: FolderEntityType::File,
            details: FolderEntityDetails::from(entity),
        })
    }

    fn symlink(entity: &DirEntry) -> Option<FolderEntity> {
        entity.path().file_name().map(|filename| FolderEntity {
            name: filename.to_string_lossy().to_string(),
            fullname: entity.path().to_string_lossy().to_string(),
            kind: FolderEntityType::SymbolicLink,
            details: FolderEntityDetails::from(entity),
        })
    }
}
