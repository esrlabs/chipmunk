//! File-dialog workflow and default destination names for session exports.
//!
//! Dialogs return asynchronously, so this module stores the selected export target
//! until the matching save dialog completes.

use std::{ops::Not, path::PathBuf};

use stypes::ObserveOrigin;
use tokio::sync::mpsc::Sender;
use uuid::Uuid;

use crate::{
    host::ui::{UiActions, actions::FileDialogOptions},
    session::{
        command::{ExportTarget, SessionCommand, TextExportOptions},
        ui::shared::SessionShared,
    },
};

use super::ExportState;

/// Raw export data waiting for its save dialog result.
#[derive(Debug)]
pub struct PendingRawExport {
    /// Rows or indexed/all range to export after a destination is chosen.
    target: ExportTarget,
    /// Save dialog id used to collect the matching async output.
    dialog_id: &'static str,
}

/// Text export data waiting for its save dialog result.
#[derive(Debug)]
pub struct PendingTextExport {
    /// Rows or indexed/all range to export after a destination is chosen.
    target: ExportTarget,
    /// Text export formatting options selected before the save dialog opened.
    options: TextExportOptions,
    /// Save dialog id used to collect the matching async output.
    dialog_id: &'static str,
}

/// Result of polling an async save dialog for a selected destination.
enum DialogDestination {
    /// Dialog has not produced output yet.
    Pending,
    /// Dialog completed without a usable destination.
    Dismissed,
    /// Dialog completed with exactly one destination.
    Selected(PathBuf),
}

impl ExportState {
    /// Polls pending export save dialogs and dispatches backend export commands.
    pub fn handle_dialogs(&mut self, actions: &mut UiActions, cmd_tx: &Sender<SessionCommand>) {
        self.handle_raw_dialog(actions, cmd_tx);
        self.handle_text_dialog(actions, cmd_tx);
    }

    /// Opens a raw export save dialog and stores its target until completion.
    pub fn open_raw_dialog(
        &mut self,
        actions: &mut UiActions,
        target: ExportTarget,
        dialog_id: &'static str,
        title: &'static str,
        file_name: String,
    ) {
        self.pending_raw = Some(PendingRawExport { target, dialog_id });
        let options = FileDialogOptions::new().file_name(file_name).title(title);
        actions.file_dialog.save_file(dialog_id, options);
    }

    /// Opens a text export save dialog and stores its target/options until completion.
    pub fn open_text_dialog(
        &mut self,
        actions: &mut UiActions,
        target: ExportTarget,
        options: TextExportOptions,
        dialog_id: &'static str,
        title: &'static str,
        file_name: String,
    ) {
        self.pending_text = Some(PendingTextExport {
            target,
            options,
            dialog_id,
        });
        let options = FileDialogOptions::new().file_name(file_name).title(title);
        actions.file_dialog.save_file(dialog_id, options);
    }

    /// Dispatches a raw export once the pending save dialog returns a destination.
    fn handle_raw_dialog(&mut self, actions: &mut UiActions, cmd_tx: &Sender<SessionCommand>) {
        let Some(dialog_id) = self.pending_raw.as_ref().map(|pending| pending.dialog_id) else {
            return;
        };

        let destination = match take_dialog_destination(actions, dialog_id, "raw") {
            DialogDestination::Pending => return,
            DialogDestination::Dismissed => {
                self.pending_raw = None;
                return;
            }
            DialogDestination::Selected(destination) => destination,
        };

        let Some(pending) = self.pending_raw.take() else {
            log::error!("Missing raw export target");
            return;
        };

        let operation_id = Uuid::new_v4();
        self.track_file_export(operation_id, destination.clone());

        if !actions.try_send_command(
            cmd_tx,
            SessionCommand::ExportRaw {
                operation_id,
                destination,
                target: pending.target,
            },
        ) {
            self.clear_operation(operation_id);
        }
    }

    /// Dispatches a text export once the pending save dialog returns a destination.
    fn handle_text_dialog(&mut self, actions: &mut UiActions, cmd_tx: &Sender<SessionCommand>) {
        let Some(dialog_id) = self.pending_text.as_ref().map(|pending| pending.dialog_id) else {
            return;
        };

        let destination = match take_dialog_destination(actions, dialog_id, "text") {
            DialogDestination::Pending => return,
            DialogDestination::Dismissed => {
                self.pending_text = None;
                return;
            }
            DialogDestination::Selected(destination) => destination,
        };

        let Some(pending) = self.pending_text.take() else {
            log::error!("Missing text export target");
            return;
        };

        let operation_id = Uuid::new_v4();
        self.track_file_export(operation_id, destination.clone());

        if !actions.try_send_command(
            cmd_tx,
            SessionCommand::ExportText {
                operation_id,
                destination,
                target: pending.target,
                options: Box::new(pending.options),
            },
        ) {
            self.clear_operation(operation_id);
        }
    }
}

/// Returns the default file name for raw log export dialogs.
pub fn default_raw_file_name(shared: &SessionShared) -> String {
    const FALLBACK_FILE_NAME: &str = "indexed_export.bin";
    const SUFFIX: &str = "_export";
    const CONCAT_FILE_STEM: &str = "concat_export";

    let Some(origin) = shared.observe.operations().first().map(|op| &op.origin) else {
        return FALLBACK_FILE_NAME.to_owned();
    };

    match origin {
        ObserveOrigin::File(_, _, path) => {
            let Some(file_stem) = path.file_stem().and_then(non_empty_os_str) else {
                return FALLBACK_FILE_NAME.to_owned();
            };

            if let Some(extension) = path.extension().and_then(non_empty_os_str) {
                format!("{file_stem}{SUFFIX}.{extension}")
            } else {
                format!("{file_stem}{SUFFIX}")
            }
        }
        ObserveOrigin::Concat(files) => {
            if let Some(extension) = files
                .first()
                .and_then(|(_, _, path)| path.extension())
                .and_then(non_empty_os_str)
            {
                format!("{CONCAT_FILE_STEM}.{extension}")
            } else {
                CONCAT_FILE_STEM.to_owned()
            }
        }
        ObserveOrigin::Stream(..) => FALLBACK_FILE_NAME.to_owned(),
    }
}

/// Returns the default file name for text log export dialogs.
pub fn default_text_file_name(shared: &SessionShared) -> String {
    const FALLBACK_FILE_NAME: &str = "indexed_export.txt";
    const SUFFIX: &str = "_export.txt";

    let Some(origin) = shared.observe.operations().first().map(|op| &op.origin) else {
        return FALLBACK_FILE_NAME.to_owned();
    };

    match origin {
        ObserveOrigin::File(_, _, path) => path
            .file_stem()
            .and_then(non_empty_os_str)
            .map(|file_stem| format!("{file_stem}{SUFFIX}"))
            .unwrap_or_else(|| FALLBACK_FILE_NAME.to_owned()),
        ObserveOrigin::Concat(_) => String::from("concat_export.txt"),
        ObserveOrigin::Stream(..) => FALLBACK_FILE_NAME.to_owned(),
    }
}

/// Takes the save dialog output while preserving pending state if it is not ready yet.
fn take_dialog_destination(
    actions: &mut UiActions,
    dialog_id: &str,
    export_kind: &str,
) -> DialogDestination {
    let Some(selected_paths) = actions.file_dialog.take_output(dialog_id) else {
        return DialogDestination::Pending;
    };

    let mut destinations = selected_paths.into_iter();
    let Some(destination) = destinations.next() else {
        return DialogDestination::Dismissed;
    };

    if destinations.next().is_some() {
        log::error!("Expected exactly one destination from {export_kind} export dialog");
        return DialogDestination::Dismissed;
    }

    DialogDestination::Selected(destination)
}

/// Converts non-empty OS strings to owned strings for suggested file names.
fn non_empty_os_str(value: &std::ffi::OsStr) -> Option<String> {
    let value = value.to_string_lossy();
    value.is_empty().not().then(|| value.into_owned())
}
