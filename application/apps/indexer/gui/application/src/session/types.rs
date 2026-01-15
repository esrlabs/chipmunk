use std::time::{Duration, Instant};

use uuid::Uuid;

use stypes::ObserveOrigin;

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
