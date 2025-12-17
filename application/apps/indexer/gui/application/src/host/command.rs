use std::path::PathBuf;

use uuid::Uuid;

use crate::host::ui::session_setup::state::{parsers::ParserConfig, sources::ByteSourceConfig};

/// Host commands to be sent from UI to its service.
#[derive(Debug, Clone)]
pub enum HostCommand {
    OpenFiles(Vec<PathBuf>),
    OpenProcessCommand,
    StartSession(Box<StartSessionParam>),
    CloseSessionSetup(Uuid),
    Close,
}

#[derive(Debug, Clone)]
pub struct StartSessionParam {
    pub session_setup_id: Uuid,
    pub parser: ParserConfig,
    pub source: ByteSourceConfig,
}
