use std::path::PathBuf;

/// Represents general application commands to be sent from UI to State.
#[derive(Debug, Clone)]
pub enum HostCommand {
    OpenFiles(Vec<PathBuf>),
    Close,
}
