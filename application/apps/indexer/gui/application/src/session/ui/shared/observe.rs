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
        colors::SOURCE_HIGHLIGHT_COLORS[source_idx % colors::SOURCE_HIGHLIGHT_COLORS.len()]
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

    /// Returns whether the startup spinner should stay visible.
    pub fn show_startup_spinner(&self, logs_count: u64) -> bool {
        // Keep the original startup behavior while the backend has not started processing yet.
        if self.operations.iter().all(ObserveOperation::initializing) {
            return true;
        }

        // File restores can report processing before the first rows are visible.
        let is_file_based = matches!(
            self.operations.first().map(|operation| &operation.origin),
            Some(ObserveOrigin::File(..) | ObserveOrigin::Concat(..))
        );

        is_file_based && !self.file_read_completed && logs_count == 0
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

#[cfg(test)]
mod tests {
    use std::path::PathBuf;

    use stypes::{FileFormat, TCPTransportConfig, Transport};

    use super::*;

    #[test]
    fn file_waits_for_first_logs() {
        let operation_id = Uuid::new_v4();
        let observe = ObserveOperation::new(
            operation_id,
            ObserveOrigin::File(
                String::from("file"),
                FileFormat::Text,
                PathBuf::from("test.log"),
            ),
        );
        let mut state = ObserveState::new(observe);
        state.update_operation(operation_id, OperationPhase::Processing);

        assert!(state.show_startup_spinner(0));
        assert!(!state.show_startup_spinner(1));
    }

    #[test]
    fn file_read_completion_stops_waiting() {
        let operation_id = Uuid::new_v4();
        let observe = ObserveOperation::new(
            operation_id,
            ObserveOrigin::Concat(vec![(
                String::from("file"),
                FileFormat::Text,
                PathBuf::from("test.log"),
            )]),
        );
        let mut state = ObserveState::new(observe);
        state.update_operation(operation_id, OperationPhase::Processing);
        state.set_file_read_completed();

        assert!(!state.show_startup_spinner(0));
    }

    #[test]
    fn stream_spinner_stops_after_processing() {
        let operation_id = Uuid::new_v4();
        let observe = ObserveOperation::new(
            operation_id,
            ObserveOrigin::Stream(
                String::from("stream"),
                Transport::TCP(TCPTransportConfig {
                    bind_addr: String::from("127.0.0.1:9000"),
                }),
            ),
        );
        let mut state = ObserveState::new(observe);
        state.update_operation(operation_id, OperationPhase::Processing);

        assert!(!state.show_startup_spinner(0));
    }
}
