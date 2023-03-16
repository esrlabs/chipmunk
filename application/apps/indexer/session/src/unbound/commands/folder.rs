use serde::{Deserialize, Serialize};

use crate::{events::ComputationError, unbound::signal::Signal};

use super::CommandOutcome;

#[derive(Serialize, Deserialize)]
struct FolderContent {
    files: Vec<String>,
}
pub fn get_folder_content(
    path: &str,
    _signal: Signal,
) -> Result<CommandOutcome<String>, ComputationError> {
    use walkdir::WalkDir;
    let file_list: Vec<String> = WalkDir::new(path)
        .into_iter()
        .filter_map(|file| file.ok())
        .filter(|file| file.metadata().map(|md| md.is_file()).unwrap_or(false))
        .map(|file| format!("{}", file.path().display()))
        .collect();
    let f = FolderContent { files: file_list };
    serde_json::to_string(&f)
        .map(CommandOutcome::Finished)
        .map_err(|e| -> ComputationError {
            ComputationError::Process(format!("Could not produce json: {e}"))
        })
}
