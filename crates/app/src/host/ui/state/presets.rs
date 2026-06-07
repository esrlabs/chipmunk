//! Host UI handlers for preset import and export messages.

use std::{
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
    let source = match format {
        ImportFormat::Version1 | ImportFormat::Version2 => "preset file",
        ImportFormat::Legacy => "legacy preset file",
    };

    let mut message = if imported_count == 0 {
        format!(
            "No presets were imported from {} '{}'.",
            source,
            path.display()
        )
    } else {
        format!(
            "Imported {imported_count} {} from {} '{}'.",
            pluralize(imported_count, "preset", "presets"),
            source,
            path.display()
        )
    };

    if renamed_count > 0 {
        // writing to String should never fail
        let _ = write!(
            message,
            " Renamed {renamed_count} {} to avoid name collisions.",
            pluralize(renamed_count, "preset", "presets")
        );
    }

    match format {
        ImportFormat::Version1 => {
            message.push_str(
                " V1 preset files do not store row colors or enabled state, so defaults were applied. Re-export these presets to preserve that state in future imports.",
            );
        }
        ImportFormat::Version2 | ImportFormat::Legacy => {}
    }

    message
}

fn format_preset_export_report(path: &Path, count: usize) -> String {
    format!(
        "Exported {count} {} to '{}'.",
        pluralize(count, "preset", "presets"),
        path.display()
    )
}

fn pluralize<'a>(count: usize, singular: &'a str, plural: &'a str) -> &'a str {
    if count == 1 { singular } else { plural }
}
