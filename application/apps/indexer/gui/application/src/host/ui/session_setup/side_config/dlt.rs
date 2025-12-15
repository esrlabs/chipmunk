use egui::{RichText, Ui};

use crate::host::ui::{
    UiActions,
    session_setup::state::parsers::dlt::{DltLogLevel, DltParserConfig},
};

use super::shared::fibex_file_selector;

pub fn render_content(config: &mut DltParserConfig, actions: &mut UiActions, ui: &mut Ui) {
    log_level_selector(config, ui);
    ui.separator();

    fibex_file_selector("dlt_fibex_dialog", &mut config.fibex_files, actions, ui);
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
