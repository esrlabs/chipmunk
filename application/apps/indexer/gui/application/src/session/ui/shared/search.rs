use std::collections::HashMap;

use stypes::FilterMatch;
use uuid::Uuid;

use crate::session::{types::OperationPhase, ui::definitions::UpdateOperationOutcome};

#[allow(unused)]
#[derive(Debug, Clone, Copy)]
pub struct FilterIndex(pub u8);

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct LogMainIndex(pub u64);

#[derive(Debug, Clone)]
struct SearchOperation {
    pub id: Uuid,
    pub phase: OperationPhase,
}

impl SearchOperation {
    pub fn new(id: Uuid) -> Self {
        Self {
            id,
            phase: OperationPhase::Initializing,
        }
    }
}

#[derive(Debug, Default)]
pub struct SearchState {
    search_op: Option<SearchOperation>,
    total_count: u64,
    matches_map: Option<HashMap<LogMainIndex, Vec<FilterIndex>>>,
}

impl SearchState {
    pub fn total_count(&self) -> u64 {
        self.total_count
    }

    pub fn set_total_count(&mut self, total_count: u64) {
        // total_count and matches_map can go currently out-of-sync when
        // multiple search queries are applied rapidly.
        // This solution is a workaround until the issue is fixed in core.
        if total_count == 0 {
            self.matches_map = None;
        }

        self.total_count = total_count;
    }

    pub fn set_search_operation(&mut self, operation_id: Uuid) {
        self.search_op = Some(SearchOperation::new(operation_id));
    }

    pub fn processing_search_operation(&self) -> Option<Uuid> {
        self.search_op.as_ref().and_then(|op| {
            if op.phase != OperationPhase::Done {
                Some(op.id)
            } else {
                None
            }
        })
    }

    pub fn search_operation_phase(&self) -> Option<OperationPhase> {
        self.search_op.as_ref().map(|op| op.phase)
    }

    pub fn is_search_active(&self) -> bool {
        self.search_op.is_some()
    }

    pub fn drop_search(&mut self) {
        let Self {
            search_op: operation_op,
            total_count,
            matches_map,
        } = self;

        *operation_op = None;
        *total_count = 0;
        *matches_map = None;
    }

    pub fn update_operation(
        &mut self,
        operation_id: Uuid,
        phase: OperationPhase,
    ) -> UpdateOperationOutcome {
        if let Some(search_op) = &mut self.search_op
            && search_op.id == operation_id
        {
            search_op.phase = phase;
            UpdateOperationOutcome::Consumed
        } else {
            UpdateOperationOutcome::None
        }
    }

    pub fn append_matches(&mut self, filter_matches: Vec<FilterMatch>) {
        let Some(operation) = &mut self.search_op else {
            return;
        };

        operation.phase = OperationPhase::Done;

        let matches_map = self.matches_map.get_or_insert_default();

        //TODO AAZ: Check when pending search should be updated.
        filter_matches.into_iter().for_each(|mat| {
            // Filter indexes get combined in chipmunk core.
            // We don't need to extend the indices vector and check for duplications here.
            matches_map.insert(
                LogMainIndex(mat.index),
                mat.filters.into_iter().map(FilterIndex).collect(),
            );
        });

        debug_assert_eq!(
            matches_map.len() as u64,
            self.total_count,
            "Search count and matches length can't go out of sync"
        );
    }

    pub fn current_matches_map(&self) -> Option<&HashMap<LogMainIndex, Vec<FilterIndex>>> {
        self.matches_map.as_ref()
    }
}
