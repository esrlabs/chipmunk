//! Selected plugin details rendering for the Plugin Manager.

use std::path::Path;

use chrono::{Local, TimeZone};
use egui::{
    Align, Color32, Grid, Label, Rect, Response, RichText, Sense, TextStyle, TextWrapMode, Ui,
    Vec2, Widget as _, pos2, text::LayoutJob, text::TextFormat, vec2,
};
use egui_commonmark::CommonMarkViewer;
use stypes::{InvalidPluginEntity, PluginEntity, PluginLogLevel, PluginRunData};

use crate::host::common::colors;

use super::{PluginManagerView, ReadmeStatus};

/// Active details tab for the selected plugin.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DetailsTab {
    /// Basic plugin metadata and paths.
    About,
    /// Plugin load/runtime diagnostics.
    Inspect,
}

impl PluginManagerView {
    /// Renders details for a valid installed plugin.
    pub fn render_installed_details(
        &mut self,
        ui: &mut Ui,
        plugin: &PluginEntity,
        run_data: Option<&PluginRunData>,
    ) {
        let display_name = plugin_label(&plugin.metadata.title, &plugin.dir_path);
        ui.heading(display_name);
        if let Some(description) = plugin
            .metadata
            .description
            .as_deref()
            .filter(|desc| !desc.is_empty())
        {
            let description_label = Label::new(description).wrap_mode(TextWrapMode::Wrap);
            description_label.ui(ui);
        } else {
            let directory = plugin.dir_path.display().to_string();
            selectable_wrapped_label(ui, directory);
        }
        ui.add_space(8.0);

        self.render_tabs(ui, run_data);

        match self.details_tab {
            DetailsTab::About => self.render_installed_about(ui, plugin),
            DetailsTab::Inspect => render_inspect(ui, run_data),
        }
    }

    /// Renders details for an invalid plugin directory.
    pub fn render_invalid_details(
        &mut self,
        ui: &mut Ui,
        plugin: &InvalidPluginEntity,
        run_data: Option<&PluginRunData>,
    ) {
        let display_name = path_label(&plugin.dir_path);
        ui.heading(display_name);

        let plugin_type = plugin.plugin_type.to_string();
        ui.label(plugin_type);

        let invalid_status = RichText::new("Invalid plugin").weak();
        ui.label(invalid_status);
        ui.add_space(8.0);

        self.render_tabs(ui, run_data);

        match self.details_tab {
            DetailsTab::About => render_invalid_about(ui, plugin),
            DetailsTab::Inspect => render_inspect(ui, run_data),
        }
    }

    fn render_tabs(&mut self, ui: &mut Ui, run_data: Option<&PluginRunData>) {
        let (warnings, errors) = run_data.map(warning_error_counts).unwrap_or_default();
        let issue_count = warnings + errors;
        let dark_mode = ui.visuals().dark_mode;
        let issue_color = if errors > 0 {
            Some(colors::notification_error_color(dark_mode))
        } else if warnings > 0 {
            Some(colors::notification_warning_color(dark_mode))
        } else {
            None
        };

        const TAB_GAP: f32 = 10.0;
        const TAB_MIN_WIDTH: f32 = 70.0;
        const TAB_RIGHT_PADDING: f32 = 12.0;
        let about_size = detail_tab_size(ui, "About", 0, None, TAB_MIN_WIDTH);
        let inspect_size = detail_tab_size(ui, "Inspect", issue_count, issue_color, TAB_MIN_WIDTH);
        let tabs_width = about_size.x + TAB_GAP + inspect_size.x;

        let current_tab = self.details_tab;
        ui.horizontal(|ui| {
            let leading_space = (ui.available_width() - tabs_width - TAB_RIGHT_PADDING).max(0.0);
            ui.add_space(leading_space);

            let about_response = render_detail_tab(
                ui,
                current_tab == DetailsTab::About,
                "About",
                0,
                None,
                about_size,
            );
            ui.add_space(TAB_GAP);
            let inspect_response = render_detail_tab(
                ui,
                current_tab == DetailsTab::Inspect,
                "Inspect",
                issue_count,
                issue_color,
                inspect_size,
            );

            self.details_tab = if inspect_response.clicked() {
                DetailsTab::Inspect
            } else if about_response.clicked() {
                DetailsTab::About
            } else {
                current_tab
            };

            let selected_response = match self.details_tab {
                DetailsTab::About => &about_response,
                DetailsTab::Inspect => &inspect_response,
            };
            paint_selected_tab(ui, selected_response.rect);
        });
        ui.add_space(10.0);
    }

    fn render_installed_about(&mut self, ui: &mut Ui, plugin: &PluginEntity) {
        if plugin.readme_path.is_none() {
            render_empty_readme(ui);
            return;
        }

        self.render_readme(ui);
    }

    fn render_readme(&mut self, ui: &mut Ui) {
        match &self.readme.status {
            ReadmeStatus::Idle | ReadmeStatus::Loading { .. } => {
                let loading_text = RichText::new("Loading README...").weak();
                ui.label(loading_text);
            }
            ReadmeStatus::Loaded { content } => {
                if content.is_empty() {
                    render_empty_readme(ui);
                } else {
                    CommonMarkViewer::new().show(ui, &mut self.readme.markdown_cache, content);
                }
            }
            ReadmeStatus::Missing => {
                render_empty_readme(ui);
            }
            ReadmeStatus::Error { message } => {
                let error_text = RichText::new("Failed to load README.").strong();
                ui.label(error_text);

                let message_label = Label::new(message)
                    .selectable(true)
                    .wrap_mode(TextWrapMode::Wrap);
                message_label.ui(ui);
            }
        }
    }
}

fn render_invalid_about(ui: &mut Ui, plugin: &InvalidPluginEntity) {
    Grid::new("plugin_manager_invalid_about")
        .num_columns(2)
        .spacing(vec2(12.0, 6.0))
        .show(ui, |ui| {
            ui.strong("Name");
            let display_name = path_label(&plugin.dir_path);
            ui.label(display_name);
            ui.end_row();

            ui.strong("Type");
            let plugin_type = plugin.plugin_type.to_string();
            ui.label(plugin_type);
            ui.end_row();

            ui.strong("Directory");
            let directory = plugin.dir_path.display().to_string();
            selectable_wrapped_label(ui, directory);
            ui.end_row();
        });
}

fn render_detail_tab(
    ui: &mut Ui,
    selected: bool,
    label: &str,
    issue_count: usize,
    issue_color: Option<Color32>,
    size: Vec2,
) -> Response {
    let click_sense = Sense::click();
    let (rect, response) = ui.allocate_exact_size(size, click_sense);

    if ui.is_rect_visible(rect) {
        let text_color = if selected || response.hovered() {
            ui.visuals().strong_text_color()
        } else {
            ui.visuals().text_color()
        };
        let tab_label = detail_tab_label(ui, label, issue_count, issue_color, text_color);
        let layout = ui.painter().layout_job(tab_label);
        let text_x = rect.center().x - layout.size().x / 2.0;
        let text_pos = pos2(text_x, rect.min.y);
        ui.painter().galley(text_pos, layout, text_color);
    }

    response
}

fn detail_tab_size(
    ui: &Ui,
    label: &str,
    issue_count: usize,
    issue_color: Option<Color32>,
    min_width: f32,
) -> Vec2 {
    let text_color = ui.visuals().text_color();
    let tab_label = detail_tab_label(ui, label, issue_count, issue_color, text_color);
    let layout = ui.painter().layout_job(tab_label);
    let mut size = layout.size();
    size.x = size.x.max(min_width);
    size
}

fn detail_tab_label(
    ui: &Ui,
    label: &str,
    issue_count: usize,
    issue_color: Option<Color32>,
    text_color: Color32,
) -> LayoutJob {
    let mut text = LayoutJob::default();
    let body_font_id = TextStyle::Body.resolve(ui.style());
    text.append(
        label,
        0.0,
        TextFormat {
            font_id: body_font_id,
            color: text_color,
            ..Default::default()
        },
    );

    if issue_count > 0
        && let Some(color) = issue_color
    {
        let issue_text = format!("({issue_count})");
        let small_font_id = TextStyle::Small.resolve(ui.style());
        text.append(
            &issue_text,
            3.0,
            TextFormat {
                font_id: small_font_id,
                color,
                valign: Align::TOP,
                ..Default::default()
            },
        );
    }

    text
}

fn paint_selected_tab(ui: &Ui, rect: Rect) {
    let y = rect.bottom() + 2.0;
    let underline_min = pos2(rect.left(), y);
    let underline_max = pos2(rect.right(), y + 2.0);
    let underline = Rect::from_min_max(underline_min, underline_max);
    let underline_color = colors::main_accent_stroke(ui.visuals().dark_mode);
    ui.painter().rect_filled(underline, 1.0, underline_color);
}

fn render_empty_readme(ui: &mut Ui) {
    let empty_text = RichText::new("This plugin does not include README content.").weak();
    ui.label(empty_text);
}

fn render_inspect(ui: &mut Ui, run_data: Option<&PluginRunData>) {
    let Some(run_data) = run_data else {
        let empty_text = RichText::new("No run logs.").weak();
        ui.label(empty_text);

        return;
    };

    let (warnings, errors) = warning_error_counts(run_data);
    ui.horizontal(|ui| {
        let errors_label = format!("Errors: {errors}");
        ui.label(errors_label);

        let warnings_label = format!("Warnings: {warnings}");
        ui.label(warnings_label);
    });
    ui.add_space(6.0);

    if run_data.logs.is_empty() {
        let empty_text = RichText::new("No run logs.").weak();
        ui.label(empty_text);

        return;
    }

    let dark_mode = ui.visuals().dark_mode;
    let grid_spacing = vec2(12.0, 4.0);
    Grid::new("plugin_manager_inspect_logs")
        .num_columns(3)
        .spacing(grid_spacing)
        .show(ui, |ui| {
            for log in &run_data.logs {
                let timestamp = Local
                    .timestamp_opt(log.timestamp as i64, 0)
                    .single()
                    .map(|time| time.format("%Y-%m-%d %H:%M:%S").to_string())
                    .unwrap_or_else(|| log.timestamp.to_string());
                let (level, color) = log_level_display(&log.level, dark_mode);

                let timestamp_text = RichText::new(timestamp).monospace().color(color);
                ui.label(timestamp_text);

                let level_text = RichText::new(level).color(color);
                ui.label(level_text);

                let message_text = RichText::new(log.msg.as_str()).color(color);
                let message_label = Label::new(message_text).selectable(true).wrap();
                message_label.ui(ui);

                ui.end_row();
            }
        });
}

fn log_level_display(level: &PluginLogLevel, dark_mode: bool) -> (&'static str, Color32) {
    match level {
        PluginLogLevel::Err => ("Error", colors::notification_error_color(dark_mode)),
        PluginLogLevel::Warn => ("Warning", colors::notification_warning_color(dark_mode)),
        PluginLogLevel::Debug => ("Debug", Color32::PLACEHOLDER),
        PluginLogLevel::Info => ("Info", Color32::PLACEHOLDER),
    }
}

fn selectable_wrapped_label(ui: &mut Ui, text: String) {
    let label = Label::new(text)
        .selectable(true)
        .wrap_mode(TextWrapMode::Wrap);
    label.ui(ui);
}

fn warning_error_counts(run_data: &PluginRunData) -> (usize, usize) {
    let warnings = run_data
        .logs
        .iter()
        .filter(|log| matches!(&log.level, PluginLogLevel::Warn))
        .count();
    let errors = run_data
        .logs
        .iter()
        .filter(|log| matches!(&log.level, PluginLogLevel::Err))
        .count();

    (warnings, errors)
}

/// Returns the display label for a plugin, falling back to its directory name.
pub fn plugin_label(title: &str, path: &Path) -> String {
    if title.is_empty() {
        path_label(path)
    } else {
        title.to_owned()
    }
}

/// Returns the final path component, or the full path when no file name exists.
pub fn path_label(path: &Path) -> String {
    path.file_name()
        .map(|name| name.to_string_lossy().into_owned())
        .unwrap_or_else(|| path.display().to_string())
}
