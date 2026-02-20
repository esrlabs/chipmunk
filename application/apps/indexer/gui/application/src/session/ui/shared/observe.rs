use egui::Color32;
use stypes::ObserveOrigin;
use uuid::Uuid;

use crate::{
    host::common::colors,
    session::{
        types::{ObserveOperation, OperationPhase},
        ui::definitions::UpdateOperationOutcome,
    },
};

#[derive(Debug, Clone)]
pub struct ObserveState {
    sources_count: usize,
    operations: Vec<ObserveOperation>,
    /// Indicates if the initial file reading process has completed.
    /// This is only relevant for file sources.
    file_read_completed: bool,
}

impl ObserveState {
    pub fn new(observe_op: ObserveOperation) -> Self {
        let mut state = Self {
            sources_count: 0,
            operations: Vec::with_capacity(1),
            file_read_completed: false,
        };
        state.add_operation(observe_op);

        state
    }

    pub fn source_color(source_idx: usize) -> Color32 {
        colors::HIGHLIGHT_COLORS[source_idx % colors::HIGHLIGHT_COLORS.len()].bg
    }

    pub(super) fn add_operation(&mut self, observe_op: ObserveOperation) {
        let Self {
            sources_count,
            operations,
            file_read_completed: _,
        } = self;

        operations.push(observe_op);

        let new_op_count = match &operations.last().unwrap().origin {
            ObserveOrigin::File(..) | ObserveOrigin::Stream(..) => 1,
            ObserveOrigin::Concat(items) => items.len(),
        };
        *sources_count += new_op_count;
    }

    pub fn sources_count(&self) -> usize {
        self.sources_count
    }

    pub fn update_operation(
        &mut self,
        operation_id: Uuid,
        phase: OperationPhase,
    ) -> UpdateOperationOutcome {
        if let Some(observe) = self.operations.iter_mut().find(|o| o.id == operation_id) {
            observe.set_phase(phase);
            UpdateOperationOutcome::Consumed
        } else {
            UpdateOperationOutcome::None
        }
    }

    /// Observe operations.
    pub fn operations(&self) -> &[ObserveOperation] {
        &self.operations
    }

    /// Check if the session is still in the initial loading state before
    /// producing any logs.
    pub fn is_initial_loading(&self) -> bool {
        self.operations.iter().all(ObserveOperation::initializing)
    }

    /// Mark the initial file reading as completed.
    pub fn set_file_read_completed(&mut self) {
        self.file_read_completed = true
    }

    /// Check if the initial file reading has completed.
    pub fn is_file_read_completed(&self) -> bool {
        self.file_read_completed
    }
}
