use std::path::PathBuf;

use uuid::Uuid;

use crate::host::common::{parsers::ParserConfig, sources::ByteSourceType};

/// Host commands to be sent from UI to its service.
#[derive(Debug, Clone)]
pub enum HostCommand {
    OpenFiles(Vec<PathBuf>),
    StartSession {
        session_setup_id: Uuid,
        parser: ParserConfig,
        source: ByteSourceType,
    },
    CloseSessionSetup(Uuid),
    Close,
}
