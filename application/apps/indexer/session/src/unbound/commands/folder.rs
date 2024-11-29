use crate::unbound::signal::Signal;
use walkdir::{DirEntry, WalkDir};

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
) -> Result<stypes::CommandOutcome<stypes::FoldersScanningResult>, stypes::ComputationError> {
    let mut list: Vec<stypes::FolderEntity> = vec![];
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
                    return Ok(stypes::CommandOutcome::Cancelled);
                }
                if let Some(entity) = if let Ok(md) = dir_entry.metadata() {
                    stypes::FolderEntity::from(&dir_entry, &md)
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
    Ok(stypes::CommandOutcome::Finished(
        stypes::FoldersScanningResult {
            list,
            max_len_reached,
        },
    ))
}

fn check_file_or_folder(e: &DirEntry, include_files: bool, include_folders: bool) -> bool {
    match (include_files, include_folders) {
        (true, true) => true,
        (true, false) => e.file_type().is_file(),
        (false, true) => e.file_type().is_dir(),
        _ => false,
    }
}
