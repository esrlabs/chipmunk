use std::{ffi::OsStr, fs::Metadata};
use walkdir::{DirEntry, WalkDir};

use serde::{Deserialize, Serialize};

use crate::{events::ComputationError, unbound::signal::Signal};

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

pub fn get_folder_content(
    path: &str,
    depth: usize,
    signal: Signal,
) -> Result<CommandOutcome<String>, ComputationError> {
    let mut list: Vec<Entity> = vec![];
    for dir_entry in WalkDir::new(path)
        .min_depth(1)
        .max_depth(depth)
        .contents_first(false)
    {
        if signal.is_cancelling() {
            return Ok(CommandOutcome::Cancelled);
        }
        if let Ok(dir_entry) = dir_entry {
            if let Some(entity) = if let Ok(md) = dir_entry.metadata() {
                Entity::from(&dir_entry, &md)
            } else {
                None
            } {
                list.push(entity)
            }
        }
    }
    serde_json::to_string(&list)
        .map(CommandOutcome::Finished)
        .map_err(|e| -> ComputationError {
            ComputationError::Process(format!("Could not produce json: {e}"))
        })
}
