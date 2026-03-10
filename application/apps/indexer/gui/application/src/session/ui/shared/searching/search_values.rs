//! Session-side state for the search-values extraction pipeline used by charts.
//!
//! [`SearchValuesState`] tracks the backend operation that extracts numeric values from enabled
//! search-value filters and exposes the chart-oriented metadata needed by the UI.
//! It is separate from [`SearchState`](super::SearchState) because chart extraction and log search
//! have different outputs and operation lifecycles.

use std::collections::HashMap;
use uuid::Uuid;

use crate::session::{types::OperationPhase, ui::definitions::UpdateOperationOutcome};

#[derive(Debug, Clone)]
/// Metadata for the currently running search-values backend operation.
struct SearchValuesOperation {
    /// Backend operation identifier used for updates/cancel.
    id: Uuid,
    /// Latest known operation phase from backend events.
    phase: OperationPhase,
}

impl SearchValuesOperation {
    /// Creates a new operation in the `Initializing` phase.
    fn new(id: Uuid) -> Self {
        Self {
            id,
            phase: OperationPhase::Initializing,
        }
    }
}

#[derive(Debug, Default)]
/// Shared state for search-values pipeline synchronization in a session.
pub struct SearchValuesState {
    /// Active search-values operation, if one is currently tracked.
    operation: Option<SearchValuesOperation>,
    /// Latest pushed min/max metadata keyed by backend search-value index.
    values_map: Option<HashMap<u8, (f64, f64)>>,
}

impl SearchValuesState {
    /// Starts tracking a new search-values operation and replaces any previous one.
    pub fn set_operation(&mut self, id: Uuid) {
        self.operation = Some(SearchValuesOperation::new(id));
    }

    /// Drops the current search-values state and clears cached metadata.
    pub fn drop_search_values(&mut self) {
        self.operation = None;
        self.values_map = None;
    }

    /// Returns the current operation id while it is still running.
    ///
    /// `Done` operations are treated as non-running and return `None`.
    pub fn processing_operation(&self) -> Option<Uuid> {
        self.operation.as_ref().and_then(|op| {
            if op.phase != OperationPhase::Done {
                Some(op.id)
            } else {
                None
            }
        })
    }

    pub fn operation_phase(&self) -> Option<OperationPhase> {
        self.operation.as_ref().map(|op| op.phase)
    }

    pub fn set_values_map(&mut self, values_map: Option<HashMap<u8, (f64, f64)>>) {
        self.values_map = values_map;
    }

    pub fn current_values_map(&self) -> Option<&HashMap<u8, (f64, f64)>> {
        self.values_map.as_ref()
    }

    pub fn update_operation(
        &mut self,
        operation_id: Uuid,
        phase: OperationPhase,
    ) -> UpdateOperationOutcome {
        if let Some(operation) = self.operation.as_mut()
            && operation.id == operation_id
        {
            operation.phase = phase;
            UpdateOperationOutcome::Consumed
        } else {
            UpdateOperationOutcome::None
        }
    }
}

#[cfg(test)]
mod tests {
    use std::collections::HashMap;

    use uuid::Uuid;

    use crate::session::{types::OperationPhase, ui::definitions::UpdateOperationOutcome};

    use super::SearchValuesState;

    #[test]
    fn drop_search_values_clears_state() {
        let mut state = SearchValuesState::default();
        state.set_operation(Uuid::new_v4());
        state.set_values_map(Some(HashMap::from([(0, (1.0, 2.0))])));

        state.drop_search_values();

        assert!(state.processing_operation().is_none());
        assert!(state.operation_phase().is_none());
        assert!(state.current_values_map().is_none());
    }

    #[test]
    fn set_values_map_replaces_content() {
        let mut state = SearchValuesState::default();
        let values = HashMap::from([(0, (1.5, 4.5)), (1, (-3.0, 2.0))]);

        state.set_values_map(Some(values.clone()));

        assert_eq!(state.current_values_map(), Some(&values));
    }

    #[test]
    fn set_values_map_clears_content() {
        let mut state = SearchValuesState::default();
        state.set_values_map(Some(HashMap::from([(0, (1.0, 2.0))])));

        state.set_values_map(None);

        assert!(state.current_values_map().is_none());
    }

    #[test]
    fn done_operation_keeps_phase() {
        let operation_id = Uuid::new_v4();
        let mut state = SearchValuesState::default();
        state.set_operation(operation_id);

        let outcome = state.update_operation(operation_id, OperationPhase::Done);

        assert!(matches!(outcome, UpdateOperationOutcome::Consumed));
        assert!(state.processing_operation().is_none());
        assert_eq!(state.operation_phase(), Some(OperationPhase::Done));
    }
}
