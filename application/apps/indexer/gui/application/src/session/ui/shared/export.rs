//! Tracks pending export operations and turns terminal phases into user notifications.

use std::{collections::HashMap, path::PathBuf};

use uuid::Uuid;

use crate::{
    host::{notification::AppNotification, ui::UiActions},
    session::{types::OperationPhase, ui::definitions::UpdateOperationOutcome},
};

/// UI state for exports started from this session.
#[derive(Debug, Default)]
pub struct ExportState {
    /// Pending export operation destinations by backend operation id.
    pub pending_op: HashMap<Uuid, PathBuf>,
}

impl ExportState {
    /// Handles one operation phase update and emits export notifications for terminal phases.
    pub fn handle_phase(
        &mut self,
        operation_id: Uuid,
        phase: OperationPhase,
        actions: &mut UiActions,
    ) -> UpdateOperationOutcome {
        if !self.pending_op.contains_key(&operation_id) {
            return UpdateOperationOutcome::None;
        }

        match phase {
            OperationPhase::Initializing | OperationPhase::Processing => {
                UpdateOperationOutcome::Consumed
            }
            OperationPhase::Success => {
                if let Some(destination) = self.pending_op.remove(&operation_id) {
                    actions.add_notification(AppNotification::Info(format!(
                        "Exported raw logs to {}",
                        destination.display()
                    )));
                }
                UpdateOperationOutcome::Consumed
            }
            OperationPhase::Failed => {
                self.pending_op.remove(&operation_id);
                // The service already emits the detailed session error notification.
                UpdateOperationOutcome::Consumed
            }
            OperationPhase::Skipped => {
                self.pending_op.remove(&operation_id);
                actions
                    .add_notification(AppNotification::Warning(String::from("No rows to export.")));
                UpdateOperationOutcome::Consumed
            }
        }
    }
}
