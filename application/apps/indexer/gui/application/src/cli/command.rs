use std::path::PathBuf;

/// Represents commands from CLI to be executed after app is started.
#[derive(Debug, Clone)]
pub enum CliCommand {
    OpenFiles {
        paths: Vec<PathBuf>,
    },
    ProcessCommand {
        command: String,
        cwd: Option<PathBuf>,
    },
}
