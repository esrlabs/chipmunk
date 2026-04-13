use std::path::PathBuf;
use std::time::{Duration, Instant};

use uuid::Uuid;

use stypes::{FileFormat, ObserveOrigin};

/// Represents a running observe operations with its info.
#[derive(Debug, Clone)]
pub struct ObserveOperation {
    pub id: Uuid,
    phase: OperationPhase,
    pub origin: ObserveOrigin,
    started: Instant,
    duration: Option<Duration>,
}

impl ObserveOperation {
    pub fn new(id: Uuid, origin: ObserveOrigin) -> Self {
        Self {
            id,
            phase: OperationPhase::Initializing,
            origin,
            started: Instant::now(),
            duration: None,
        }
    }

    pub fn set_phase(&mut self, phase: OperationPhase) {
        match phase {
            OperationPhase::Initializing | OperationPhase::Processing => {}
            OperationPhase::Done => {
                self.duration = Some(self.started.elapsed());
            }
        }

        self.phase = phase;
    }

    #[allow(unused)]
    pub fn phase(&self) -> OperationPhase {
        self.phase
    }

    pub fn total_run_duration(&self) -> Option<Duration> {
        self.duration
    }

    pub fn processing(&self) -> bool {
        self.phase == OperationPhase::Processing
    }

    pub fn done(&self) -> bool {
        self.phase == OperationPhase::Done
    }

    pub fn initializing(&self) -> bool {
        self.phase == OperationPhase::Initializing
    }
}

/// Represents a running operation phase.
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum OperationPhase {
    /// Operation is started and waiting to start processing it's data.
    Initializing,
    /// Operation is processing data.
    Processing,
    /// Operation is done.
    Done,
}

impl OperationPhase {
    pub fn is_running(self) -> bool {
        match self {
            OperationPhase::Initializing | OperationPhase::Processing => true,
            OperationPhase::Done => false,
        }
    }
}

/// Metadata about a file or source loaded in the session.
#[allow(dead_code)]
#[derive(Debug, Clone)]
pub struct FileMetadata {
    /// Display name of the source.
    pub name: String,
    /// The file format (Text, Binary, PcapNG, PcapLegacy) or "Stream" for live sources.
    pub file_type: String,
    /// Absolute path of the file, if applicable.
    pub path: Option<PathBuf>,
    /// Total number of log lines currently loaded.
    pub total_lines: u64,
}

impl FileMetadata {
    pub fn file_format_label(format: &FileFormat) -> &'static str {
        match format {
            FileFormat::Text => "Text",
            FileFormat::Binary => "Binary",
            FileFormat::PcapNG => "PcapNG",
            FileFormat::PcapLegacy => "PcapLegacy",
        }
    }

    pub fn as_chat_message(&self) -> String {
        format!(
            "name => {}\nfile type => {}\ntotal lines in the file => {}",
            self.name, self.file_type, self.total_lines
        )
    }
}
