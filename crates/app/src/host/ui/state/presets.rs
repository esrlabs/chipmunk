//! Host UI handlers for preset import and export messages.

use std::{
    borrow::Cow,
    fmt::Write,
    path::{Path, PathBuf},
};

use crate::host::{
    message::{ImportFormat, PresetsImported},
    notification::AppNotification,
    ui::UiActions,
};

use super::HostState;

impl HostState {
    /// Imports backend-loaded presets into the registry and reports the result.
    pub fn handle_presets_imported(
        &mut self,
        imported: PresetsImported,
        ui_actions: &mut UiActions,
    ) {
        let PresetsImported {
            path,
            presets,
            format,
        } = imported;

        let imported_count = presets.len();
        let summary = self.registry.presets.import_presets(presets);
        ui_actions.add_notification(AppNotification::Info(format_preset_import_report(
            &path,
            imported_count,
            format,
            summary.renamed_items,
        )));
    }

    /// Reports a completed preset export.
    pub fn handle_presets_exported(&self, path: PathBuf, count: usize, ui_actions: &mut UiActions) {
        ui_actions.add_notification(AppNotification::Info(format_preset_export_report(
            &path, count,
        )));
    }
}

fn format_preset_import_report(
    path: &Path,
    imported_count: usize,
    format: ImportFormat,
    renamed_count: usize,
) -> String {
    let file_label = file_label(path);
    let mut message = if imported_count == 0 {
        format!("No presets were imported from '{file_label}'.")
    } else {
        format!(
            "Imported {imported_count} {} from '{file_label}'.",
            pluralize(imported_count, "preset", "presets")
        )
    };

    if renamed_count > 0 {
        // writing to String should never fail
        let _ = write!(
            message,
            "\nRenamed {renamed_count} {} to avoid duplicate names.",
            pluralize(renamed_count, "preset", "presets")
        );
    }

    match format {
        ImportFormat::Version1 => {
            message.push_str(
                "\nThis older preset file does not include all current preset settings. \
                    Export these presets again to preserve the complete settings for future imports.",
            );
        }
        ImportFormat::Version2 | ImportFormat::Legacy => {}
    }

    message
}

fn format_preset_export_report(path: &Path, count: usize) -> String {
    let file_label = file_label(path);
    format!(
        "Exported {count} {} to '{file_label}'.",
        pluralize(count, "preset", "presets")
    )
}

fn file_label(path: &Path) -> Cow<'_, str> {
    path.file_name()
        .map(|file_name| file_name.to_string_lossy())
        .unwrap_or_else(|| Cow::Owned(path.display().to_string()))
}

fn pluralize<'a>(count: usize, singular: &'a str, plural: &'a str) -> &'a str {
    if count == 1 { singular } else { plural }
}
