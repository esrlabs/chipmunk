use std::{
    fmt::Write,
    path::{Path, PathBuf},
};

use crate::host::{message::PresetsImported, notification::AppNotification, ui::UiActions};

use super::HostState;

impl HostState {
    pub fn handle_presets_imported(
        &mut self,
        imported: PresetsImported,
        ui_actions: &mut UiActions,
    ) {
        let PresetsImported {
            path,
            presets,
            used_legacy_format,
        } = imported;

        let imported_count = presets.len();
        let summary = self.registry.presets.import_presets(presets);
        ui_actions.add_notification(AppNotification::Info(format_preset_import_report(
            &path,
            imported_count,
            used_legacy_format,
            summary.renamed_items,
        )));
    }

    pub fn handle_presets_exported(&self, path: PathBuf, count: usize, ui_actions: &mut UiActions) {
        ui_actions.add_notification(AppNotification::Info(format_preset_export_report(
            &path, count,
        )));
    }
}

fn format_preset_import_report(
    path: &Path,
    imported_count: usize,
    used_legacy_format: bool,
    renamed_count: usize,
) -> String {
    let source = if used_legacy_format {
        "legacy preset file"
    } else {
        "preset file"
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

#[cfg(test)]
mod tests {
    use std::path::Path;

    use super::{format_preset_export_report, format_preset_import_report};

    #[test]
    fn import_report_for_document_file() {
        let message = format_preset_import_report(Path::new("presets.json"), 2, false, 0);

        assert_eq!(
            message,
            "Imported 2 presets from preset file 'presets.json'."
        );
    }

    #[test]
    fn import_report_for_legacy_file_with_renames() {
        let message = format_preset_import_report(Path::new("legacy.json"), 3, true, 2);

        assert_eq!(
            message,
            "Imported 3 presets from legacy preset file 'legacy.json'. Renamed 2 presets to avoid name collisions."
        );
    }

    #[test]
    fn import_report_for_empty_import() {
        let message = format_preset_import_report(Path::new("legacy.json"), 0, true, 0);

        assert_eq!(
            message,
            "No presets were imported from legacy preset file 'legacy.json'."
        );
    }

    #[test]
    fn export_report_for_multiple_presets() {
        let message = format_preset_export_report(Path::new("presets.json"), 2);

        assert_eq!(message, "Exported 2 presets to 'presets.json'.");
    }
}
