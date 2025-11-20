use std::path::PathBuf;

/// Host commands to be sent from UI to its service.
#[derive(Debug, Clone)]
pub enum HostCommand {
    OpenFiles(Vec<PathBuf>),
    Close,
}
