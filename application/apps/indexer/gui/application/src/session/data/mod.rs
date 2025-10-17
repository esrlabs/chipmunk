use std::path::PathBuf;

#[derive(Debug)]
pub struct SessionState {
    pub file_path: PathBuf,
    pub content_lines: Vec<String>,
}

impl SessionState {
    pub fn create(file_path: PathBuf) -> std::io::Result<Self> {
        let file_content = std::fs::read_to_string(&file_path)?;

        let content_lines = file_content.lines().map(|line| line.to_owned()).collect();

        let state = Self {
            file_path,
            content_lines,
        };

        Ok(state)
    }
}
