use std::{ffi::OsStr, fs::Metadata};
use walkdir::{DirEntry, WalkDir};

use serde::{Deserialize, Serialize};

use crate::unbound::signal::Signal;

use super::CommandOutcome;

#[allow(clippy::upper_case_acronyms)]
#[derive(Serialize, Deserialize)]
enum EntityType {
    BlockDevice = 0,
    CharacterDevice = 1,
    Directory = 2,
    FIFO = 3,
    File = 4,
    Socket = 5,
    SymbolicLink = 6,
}

#[derive(Serialize, Deserialize)]
struct EntityDetails {
    filename: String,
    full: String,
    path: String,
    basename: String,
    ext: String,
}

impl EntityDetails {
    pub fn from(entity: &DirEntry) -> Option<EntityDetails> {
        entity.path().parent().map(|parent| EntityDetails {
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

#[derive(Serialize, Deserialize)]
struct ScanningResult {
    pub list: Vec<Entity>,
    pub max_len_reached: bool,
}

#[derive(Serialize, Deserialize)]
struct Entity {
    name: String,
    fullname: String,
    kind: EntityType,
    details: Option<EntityDetails>,
}

impl Entity {
    pub fn from(entity: &DirEntry, md: &Metadata) -> Option<Entity> {
        if md.is_dir() {
            Entity::dir(entity)
        } else if md.is_symlink() {
            Entity::symlink(entity)
        } else {
            Entity::file(entity)
        }
    }

    fn dir(entity: &DirEntry) -> Option<Entity> {
        entity.path().file_name().map(|filename| Entity {
            name: filename.to_string_lossy().to_string(),
            fullname: entity.path().to_string_lossy().to_string(),
            kind: EntityType::Directory,
            details: None,
        })
    }

    fn file(entity: &DirEntry) -> Option<Entity> {
        entity.path().file_name().map(|filename| Entity {
            name: filename.to_string_lossy().to_string(),
            fullname: entity.path().to_string_lossy().to_string(),
            kind: EntityType::File,
            details: EntityDetails::from(entity),
        })
    }

    fn symlink(entity: &DirEntry) -> Option<Entity> {
        entity.path().file_name().map(|filename| Entity {
            name: filename.to_string_lossy().to_string(),
            fullname: entity.path().to_string_lossy().to_string(),
            kind: EntityType::SymbolicLink,
            details: EntityDetails::from(entity),
        })
    }
}

/// Find all files and/or folders in a folder
/// We first consider all elements on the same level before
/// descending into the next level. Kind of what you would get with BFS but
/// since the library we use only does DFS, we go level by level.
///
/// paths should be a list of folders that will be searched
/// max_len         is the maximum number of items after which we will stop the search
/// max_depth       is the maximum folder level we will descend into to find items
/// signal          used to cancel the operation
/// include_files   wether to include files
/// include_folders if false folders will not be included in the result list
pub fn get_folder_content(
    paths: &[String],
    max_depth: usize,
    max_len: usize,
    include_files: bool,
    include_folders: bool,
    signal: Signal,
) -> Result<CommandOutcome<String>, stypes::ComputationError> {
    let mut list: Vec<Entity> = vec![];
    let mut max_len_reached: bool = false;
    for depth in 1..=max_depth {
        if max_len_reached {
            break;
        }
        for path in paths {
            if max_len_reached {
                break;
            }
            for dir_entry in WalkDir::new(path)
                .min_depth(depth)
                .max_depth(depth)
                .into_iter()
                .filter_map(|v| v.ok())
                .filter(|e| check_file_or_folder(e, include_files, include_folders))
            {
                if signal.is_cancelling() {
                    return Ok(CommandOutcome::Cancelled);
                }
                if let Some(entity) = if let Ok(md) = dir_entry.metadata() {
                    Entity::from(&dir_entry, &md)
                } else {
                    None
                } {
                    list.push(entity)
                }
                if list.len() >= max_len {
                    max_len_reached = true;
                    break;
                }
            }
        }
    }
    let results = ScanningResult {
        list,
        max_len_reached,
    };
    serde_json::to_string(&results)
        .map(CommandOutcome::Finished)
        .map_err(|e| -> stypes::ComputationError {
            stypes::ComputationError::Process(format!("Could not produce json: {e}"))
        })
}

fn check_file_or_folder(e: &DirEntry, include_files: bool, include_folders: bool) -> bool {
    match (include_files, include_folders) {
        (true, true) => true,
        (true, false) => e.file_type().is_file(),
        (false, true) => e.file_type().is_dir(),
        _ => false,
    }
}
