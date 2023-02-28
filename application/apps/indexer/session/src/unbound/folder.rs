use serde::{Deserialize, Serialize};
use tokio_util::sync::CancellationToken;

#[derive(Serialize, Deserialize)]
struct FolderContent {
    files: Vec<String>,
}
pub fn get_folder_content(path: &str, _cancel: CancellationToken) -> String {
    use walkdir::WalkDir;
    let file_list: Vec<String> = WalkDir::new(path)
        .into_iter()
        .filter_map(|file| file.ok())
        .filter(|file| file.metadata().unwrap().is_file())
        .map(|file| format!("{}", file.path().display()))
        .collect();
    let f = FolderContent { files: file_list };
    serde_json::to_string(&f).unwrap_or("".into())
}
