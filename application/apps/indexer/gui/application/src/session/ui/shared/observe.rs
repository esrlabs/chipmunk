use uuid::Uuid;

use crate::session::{
    types::{ObserveOperation, OperationPhase},
    ui::definitions::UpdateOperationOutcome,
};

#[derive(Debug, Clone)]
pub struct ObserveState {
    operations: Vec<ObserveOperation>,
}

impl ObserveState {
    pub fn new(observe_op: ObserveOperation) -> Self {
        Self {
            operations: vec![observe_op],
        }
    }

    pub fn update(&mut self, operation_id: Uuid, phase: OperationPhase) -> UpdateOperationOutcome {
        if let Some(observe) = self.operations.iter_mut().find(|o| o.id == operation_id) {
            observe.phase = phase;
            UpdateOperationOutcome::Consumed
        } else {
            return UpdateOperationOutcome::None;
        }
    }

    /// Observe operations.
    pub fn operations(&self) -> &[ObserveOperation] {
        &self.operations
    }
}
