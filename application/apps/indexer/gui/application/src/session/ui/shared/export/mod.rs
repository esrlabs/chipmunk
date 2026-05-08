//! Session-level export workflow state.
//!
//! Tables choose export targets and labels, while this module owns pending dialogs,
//! modal handoff, backend operation tracking, and terminal notifications.

use std::path::PathBuf;

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
    /// Backend export-like operation awaiting a terminal phase.
    pending_op: Option<PendingExportOperation>,
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
        self.pending_op.is_none()
            && self.pending_raw.is_none()
            && self.pending_text.is_none()
            && self.text_modal.is_none()
    }

    /// Starts tracking a file export operation until a terminal backend phase arrives.
    pub fn track_file_export(&mut self, operation_id: Uuid, destination: PathBuf) {
        self.pending_op = Some(PendingExportOperation {
            operation_id,
            kind: PendingExportKind::File { destination },
        });
    }

    /// Starts tracking generated search-results tab preparation.
    pub fn track_search_results_tab(&mut self, operation_id: Uuid) {
        self.pending_op = Some(PendingExportOperation {
            operation_id,
            kind: PendingExportKind::SearchResultsTab,
        });
    }

    /// Clears the tracked backend operation if it matches the provided id.
    pub fn clear_operation(&mut self, operation_id: Uuid) {
        self.pending_op
            .take_if(|operation| operation.operation_id == operation_id);
    }

    /// Returns the blocking indicator label for the active backend operation.
    pub fn busy_label(&self) -> Option<&'static str> {
        let operation = self.pending_op.as_ref()?;

        let label = match &operation.kind {
            PendingExportKind::File { .. } => "Exporting logs...",
            PendingExportKind::SearchResultsTab => "Preparing new session...",
        };

        Some(label)
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
        let Some(operation) = self.pending_op.as_ref() else {
            return UpdateOperationOutcome::None;
        };
        if operation.operation_id != operation_id {
            return UpdateOperationOutcome::None;
        }

        match phase {
            OperationPhase::Initializing | OperationPhase::Processing => {
                UpdateOperationOutcome::Consumed
            }
            OperationPhase::Success => {
                let Some(operation) = self.pending_op.take() else {
                    return UpdateOperationOutcome::None;
                };

                match operation.kind {
                    PendingExportKind::File { destination } => {
                        actions.add_notification(AppNotification::Info(format!(
                            "Exported logs to {}",
                            destination.display()
                        )));
                    }
                    PendingExportKind::SearchResultsTab => {}
                }

                UpdateOperationOutcome::Consumed
            }
            OperationPhase::Failed => {
                self.pending_op = None;
                // The service already emits the detailed session error notification.
                UpdateOperationOutcome::Consumed
            }
            OperationPhase::Skipped => {
                self.pending_op = None;
                actions
                    .add_notification(AppNotification::Warning(String::from("No rows to export.")));
                UpdateOperationOutcome::Consumed
            }
        }
    }
}

/// Single backend operation that blocks export-related UI until completion.
#[derive(Debug)]
struct PendingExportOperation {
    operation_id: Uuid,
    kind: PendingExportKind,
}

#[derive(Debug)]
enum PendingExportKind {
    /// User-selected file export; keeps the destination for the success notification.
    File { destination: PathBuf },
    /// Generated export used only to create a new search-results session tab.
    SearchResultsTab,
}

/// Creates options that export full rendered rows without column filtering.
pub fn full_row_text_options() -> TextExportOptions {
    TextExportOptions::FullRows
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::host::notification::AppNotification;

    fn test_ui_actions() -> (tokio::runtime::Runtime, UiActions) {
        let runtime = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .expect("test runtime should be created");
        let ui_actions = UiActions::new(runtime.handle().clone());

        (runtime, ui_actions)
    }

    #[test]
    fn file_export_success_reports_and_unblocks() {
        let (_runtime, mut actions) = test_ui_actions();
        let operation_id = Uuid::new_v4();
        let mut state = ExportState::default();

        state.track_file_export(operation_id, PathBuf::from("logs.txt"));

        assert!(!state.can_start());
        assert!(state.busy_label().is_some());
        assert!(
            state
                .handle_phase(operation_id, OperationPhase::Success, &mut actions)
                .consumed()
        );
        assert!(state.can_start());

        let notifications = actions.drain_notifications().collect::<Vec<_>>();
        assert_eq!(notifications.len(), 1);
        assert!(matches!(notifications[0], AppNotification::Info(_)));
    }

    #[test]
    fn results_tab_success_unblocks_without_export_notification() {
        let (_runtime, mut actions) = test_ui_actions();
        let operation_id = Uuid::new_v4();
        let mut state = ExportState::default();

        state.track_search_results_tab(operation_id);

        assert!(!state.can_start());
        assert!(state.busy_label().is_some());
        assert!(
            state
                .handle_phase(operation_id, OperationPhase::Success, &mut actions)
                .consumed()
        );
        assert!(state.can_start());
        assert_eq!(actions.drain_notifications().count(), 0);
    }

    #[test]
    fn unmatched_operation_update_is_ignored() {
        let (_runtime, mut actions) = test_ui_actions();
        let operation_id = Uuid::new_v4();
        let mut state = ExportState::default();

        state.track_search_results_tab(operation_id);

        assert_eq!(
            state.handle_phase(Uuid::new_v4(), OperationPhase::Success, &mut actions),
            UpdateOperationOutcome::None
        );
        assert!(!state.can_start());
        assert_eq!(actions.drain_notifications().count(), 0);
    }
}
