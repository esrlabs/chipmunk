use std::time::{Duration, Instant};

pub mod attachment;

use uuid::Uuid;

use stypes::ObserveOrigin;

/// Represents a running observe operations with its info.
#[derive(Debug, Clone)]
pub struct ObserveOperation {
    /// Backend operation identifier.
    pub id: Uuid,
    /// Current lifecycle phase.
    phase: OperationPhase,
    /// Source being observed.
    pub origin: ObserveOrigin,
    /// Time when tracking started.
    started: Instant,
    /// Elapsed time once the operation reaches a terminal phase.
    run_duration: Option<Duration>,
}

impl ObserveOperation {
    pub fn new(id: Uuid, origin: ObserveOrigin) -> Self {
        Self {
            id,
            phase: OperationPhase::Initializing,
            origin,
            started: Instant::now(),
            run_duration: None,
        }
    }

    pub fn set_phase(&mut self, phase: OperationPhase) {
        match phase {
            OperationPhase::Initializing | OperationPhase::Processing => {}
            OperationPhase::Success | OperationPhase::Failed | OperationPhase::Skipped => {
                self.run_duration = Some(self.started.elapsed());
            }
        }

        self.phase = phase;
    }

    pub fn phase(&self) -> OperationPhase {
        self.phase
    }

    pub fn run_duration(&self) -> Option<Duration> {
        self.run_duration
    }

    pub fn processing(&self) -> bool {
        self.phase == OperationPhase::Processing
    }

    pub fn done(&self) -> bool {
        !self.phase.is_running()
    }

    pub fn initializing(&self) -> bool {
        self.phase == OperationPhase::Initializing
    }
}

/// Represents a running operation phase.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum OperationPhase {
    /// Operation is started and waiting to start processing it's data.
    Initializing,
    /// Operation is processing data.
    Processing,
    /// Operation completed successfully.
    Success,
    /// Operation failed.
    Failed,
    /// Operation was skipped before processing work.
    Skipped,
}

impl OperationPhase {
    /// Returns whether the operation is currently running and not terminal yet.
    pub fn is_running(self) -> bool {
        match self {
            OperationPhase::Initializing | OperationPhase::Processing => true,
            OperationPhase::Success | OperationPhase::Failed | OperationPhase::Skipped => false,
        }
    }

    /// Returns whether the operation is in initializing phase.
    pub fn is_initializing(self) -> bool {
        match self {
            OperationPhase::Initializing => true,
            OperationPhase::Processing
            | OperationPhase::Success
            | OperationPhase::Failed
            | OperationPhase::Skipped => false,
        }
    }
}
