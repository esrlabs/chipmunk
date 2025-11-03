use uuid::Uuid;

/// This will be used for long running operations which can be cancelled.
#[derive(Debug, Clone, Default)]
pub struct OperationTracker {
    pub filter_op: Option<Uuid>,
}

impl OperationTracker {
    /// Get all still running operations.
    pub fn get_all(&self) -> Vec<Uuid> {
        let Self { filter_op } = self;

        let mut ops = Vec::new();

        if let Some(filter_op) = filter_op {
            ops.push(*filter_op);
        }

        ops
    }
}
