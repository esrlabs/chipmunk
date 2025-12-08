use chrono::{Offset, TimeZone, Utc};
use chrono_tz::Tz;
use egui::*;
use std::path::Path;

use crate::host::{common::parsers::DltLogLevel, ui::session_setup::SessionSetup};

impl SessionSetup {
    pub(super) fn render_side_config(&mut self, ui: &mut Ui) {
        self.log_level_selector(ui);
        ui.separator();

        self.fibex_file_selector(ui);
        ui.separator();

        self.timezone_selector(ui);
    }

    fn log_level_selector(&mut self, ui: &mut Ui) {
        let state = self.state.log_level;

        ui.label("Log Level");
        ui.label(RichText::new("Select the level of logs (required)").small());
        ui.add_space(5.0);

        egui::ComboBox::from_id_salt("log_level_combo")
            .selected_text(format!("{:?}", self.state.log_level))
            .show_ui(ui, |ui| {
                for level in DltLogLevel::all() {
                    ui.selectable_value(&mut self.state.log_level, *level, format!("{:?}", level));
                }
            });

        if state != self.state.log_level {
            self.state.update_parser(self.selected_parser);
        }
    }

    fn fibex_file_selector(&mut self, ui: &mut egui::Ui) {
        let state = self.state.fibex_files.clone();

        ui.label("Fibex Files");
        ui.label(RichText::new("Attach fibex files (optional)").small());
        ui.add_space(5.0);

        if ui.button("📂 Add").clicked() {
            let maybe_path = rfd::FileDialog::new()
                .add_filter("FIBEX", &["xml"])
                .pick_file();

            if let Some(path) = maybe_path {
                self.state.fibex_files.push(path.display().to_string());
            }
        }

        for i in (0..self.state.fibex_files.len()).rev() {
            let full_path = self.state.fibex_files[i].clone();
            let file_name = Path::new(&full_path)
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or(&full_path)
                .to_string();

            ui.horizontal(|ui| {
                ui.label(&file_name).on_hover_text(&full_path);

                if ui.button("❌").clicked() {
                    self.state.fibex_files.remove(i);
                }
            });
        }

        if state != self.state.fibex_files {
            self.state.update_parser(self.selected_parser);
        }
    }

    fn timezone_selector(&mut self, ui: &mut egui::Ui) {
        let state = self.state.timezone.clone();

        ui.label("Time Zone");
        ui.label(RichText::new("Select the utc timezone (optional)").small());
        ui.add_space(5.0);

        ui.text_edit_singleline(&mut self.state.timezone_filter);

        let mut timezones = timezone_list();
        timezones.sort_by(|a, b| a.1.partial_cmp(&b.1).unwrap_or(std::cmp::Ordering::Equal));
        let filter = self.state.timezone_filter.to_lowercase();

        egui::ScrollArea::vertical()
            .max_height(100.0)
            .show(ui, |ui| {
                for (name, offset) in timezones
                    .iter()
                    .filter(|(name, _)| name.to_lowercase().contains(&filter))
                {
                    let hours = *offset as f32 / (60.0 * 60.0);
                    let rounded = (hours * 10.0).round() / 10.0;
                    let display = format!("{name} ({:+.1})", rounded);

                    if ui
                        .selectable_label(self.state.timezone == *name, display)
                        .clicked()
                    {
                        self.state.timezone = name.clone();
                    }
                }
            });

        ui.add_space(5.0);
        ui.label(format!("Selected: {}", self.state.timezone));

        if state != self.state.timezone {
            self.state.update_parser(self.selected_parser);
        }
    }
}

pub fn timezone_list() -> Vec<(String, i32)> {
    let now = Utc::now();

    chrono_tz::TZ_VARIANTS
        .iter()
        .map(|tz: &Tz| {
            let local_time = tz.from_utc_datetime(&now.naive_utc());
            let offset = local_time.offset().fix();

            (tz.name().to_string(), offset.local_minus_utc())
        })
        .collect()
}
