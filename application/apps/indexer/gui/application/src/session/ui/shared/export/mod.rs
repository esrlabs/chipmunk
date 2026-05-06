//! Session-level export workflow state.
//!
//! Tables choose export targets and labels, while this module owns pending dialogs,
//! modal handoff, backend operation tracking, and terminal notifications.

use std::{collections::HashMap, path::PathBuf};

use uuid::Uuid;

use crate::{
    host::{notification::AppNotification, ui::UiActions},
    session::{
        command::{ExportTarget, TextExportOptions},
        types::OperationPhase,
        ui::definitions::UpdateOperationOutcome,
    },
};
use file_dialog::{PendingRawExport, PendingTextExport};

mod file_dialog;
mod modal;

pub use file_dialog::{default_raw_file_name, default_text_file_name};
pub use modal::{TextExportModalState, TextExportValidationError};

/// Export workflow state for one session.
#[derive(Debug, Default)]
pub struct ExportState {
    /// Destinations for backend export operations awaiting a terminal phase.
    pending_op: HashMap<Uuid, PathBuf>,
    /// Raw save dialog state awaiting a chosen destination or cancellation.
    pending_raw: Option<PendingRawExport>,
    /// Text save dialog state awaiting a chosen destination or cancellation.
    pending_text: Option<PendingTextExport>,
    /// Placeholder text export modal state awaiting user confirmation.
    text_modal: Option<TextExportModalState>,
}

impl ExportState {
    /// Returns whether a new export workflow can be opened.
    pub fn can_start(&self) -> bool {
        self.pending_raw.is_none() && self.pending_text.is_none() && self.text_modal.is_none()
    }

    /// Removes pending text modal state so the UI layer can render it.
    pub fn take_text_modal(&mut self) -> Option<TextExportModalState> {
        self.text_modal.take()
    }

    /// Restores text modal state when the modal stays open for another frame.
    pub fn keep_text_modal(&mut self, modal: TextExportModalState) {
        self.text_modal = Some(modal);
    }

    /// Converts confirmed modal state into the text save dialog workflow.
    pub fn export_text_modal(&mut self, actions: &mut UiActions, modal: TextExportModalState) {
        let Some(request) = modal.export_request() else {
            return;
        };

        self.open_text_dialog(
            actions,
            request.target,
            request.options,
            request.dialog_id,
            request.title,
            request.file_name,
        );
    }

    /// Opens the DLT/SomeIP text export modal.
    pub fn open_text_modal(
        &mut self,
        target: ExportTarget,
        title: &'static str,
        schema: &dyn crate::session::ui::definitions::schema::LogSchema,
        dialog_id: &'static str,
        file_name: String,
    ) {
        let modal = TextExportModalState::new(target, title, schema, dialog_id, file_name);
        self.text_modal = Some(modal);
    }

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
                        "Exported logs to {}",
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

/// Creates options that export full rendered rows without column filtering.
pub fn full_row_text_options() -> TextExportOptions {
    TextExportOptions::FullRows
}
