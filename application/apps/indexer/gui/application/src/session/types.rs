use uuid::Uuid;

use stypes::ObserveOrigin;

/// Represents a running observe operations with its info.
#[derive(Debug, Clone)]
pub struct ObserveOperation {
    pub id: Uuid,
    pub phase: OperationPhase,
    pub origin: ObserveOrigin,
}

impl ObserveOperation {
    pub fn new(id: Uuid, origin: ObserveOrigin) -> Self {
        Self {
            id,
            phase: OperationPhase::Started,
            origin,
        }
    }
}

/// Represents a running operation phase.
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum OperationPhase {
    /// Operation is started and waiting to start processing it's data.
    Started,
    /// Operation is processing data.
    Processing,
    /// Operation is done.
    Done,
}
