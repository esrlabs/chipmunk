use egui::{RichText, Ui};

use crate::host::ui::{
    UiActions,
    session_setup::state::parsers::dlt::{DltLogLevel, DltParserConfig, FibexFileInfo},
};

pub fn render_content(config: &mut DltParserConfig, actions: &mut UiActions, ui: &mut Ui) {
    log_level_selector(config, ui);
    ui.separator();

    fibex_file_selector(config, actions, ui);
    ui.separator();

    timezone_selector(config, ui);
}

fn log_level_selector(config: &mut DltParserConfig, ui: &mut Ui) {
    ui.label("Log Level");
    ui.label(RichText::new("Select the level of logs (required)").small());
    ui.add_space(5.0);

    egui::ComboBox::from_id_salt("log_level_combo")
        .selected_text(format!("{:?}", config.log_level))
        .show_ui(ui, |ui| {
            for level in DltLogLevel::all() {
                ui.selectable_value(&mut config.log_level, *level, level.to_string());
            }
        });
}

fn fibex_file_selector(config: &mut DltParserConfig, actions: &mut UiActions, ui: &mut egui::Ui) {
    ui.label("Fibex Files");
    ui.label(RichText::new("Attach fibex files (optional)").small());
    ui.add_space(5.0);

    if ui.button("📂 Add").clicked() {
        //TODO AAZ: Find solution for file dialog here.
        let maybe_path = rfd::FileDialog::new()
            .add_filter("FIBEX", &["xml"])
            .pick_file();

        if let Some(path) = maybe_path {
            let name = path
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_else(|| path.to_string_lossy().to_string());

            let file_info = FibexFileInfo { name, path };
            config.fibex_files.push(file_info);
        }
    }

    let mut to_remove = None;

    for (idx, fibex) in config.fibex_files.iter().enumerate() {
        ui.horizontal(|ui| {
            ui.label(&fibex.name).on_hover_ui(|ui| {
                ui.set_max_width(ui.spacing().tooltip_width);

                ui.label(format!("{}", fibex.path.display()));
            });

            if ui.button("❌").on_hover_text("Remove File").clicked() {
                to_remove = Some(idx);
            }
        });
    }

    if let Some(remove_idx) = to_remove.take() {
        config.fibex_files.remove(remove_idx);
    }
}

fn timezone_selector(config: &mut DltParserConfig, ui: &mut egui::Ui) {
    ui.label("Time Zone");
    ui.label(RichText::new("Select the utc timezone (optional)").small());
    ui.add_space(5.0);

    ui.text_edit_singleline(&mut config.timezone_filter);

    egui::ScrollArea::vertical()
        .max_height(100.0)
        .show(ui, |ui| {
            for (name, offset) in config
                .timezone_list
                .iter()
                .filter(|(name, _)| name.to_lowercase().contains(&config.timezone_filter))
            {
                let hours = *offset as f32 / (60.0 * 60.0);
                let rounded = (hours * 10.0).round() / 10.0;
                let display = format!("{name} ({:+.1})", rounded);

                if ui
                    .selectable_label(config.timezone.as_ref().is_some_and(|t| t == name), display)
                    .clicked()
                {
                    config.timezone = Some(name.to_owned());
                }
            }
        });

    ui.add_space(5.0);
    let content = if let Some(tz) = config.timezone.as_ref() {
        format!("Selected: {tz}")
    } else {
        "Default timezone UTC is selected".into()
    };

    ui.label(content);
}
