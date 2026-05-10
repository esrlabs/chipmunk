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
        ui.heading(plugin_label(&plugin.metadata.title, &plugin.dir_path));
        if let Some(description) = plugin
            .metadata
            .description
            .as_deref()
            .filter(|desc| !desc.is_empty())
        {
            Label::new(description).wrap_mode(TextWrapMode::Wrap).ui(ui);
        } else {
            selectable_wrapped_label(ui, plugin.dir_path.display().to_string());
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
        ui.heading(path_label(&plugin.dir_path));
        ui.label(plugin.plugin_type.to_string());
        ui.label(RichText::new("Invalid plugin").weak());
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
        let issue_color = if errors > 0 {
            Some(colors::NOTIFICATION_ERROR_COLOR)
        } else if warnings > 0 {
            Some(colors::NOTIFICATION_WARNING_COLOR)
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
            ui.add_space((ui.available_width() - tabs_width - TAB_RIGHT_PADDING).max(0.0));

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
                ui.label(RichText::new("Loading README...").weak());
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
                ui.label(RichText::new("Failed to load README.").strong());
                Label::new(message)
                    .selectable(true)
                    .wrap_mode(TextWrapMode::Wrap)
                    .ui(ui);
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
            ui.label(path_label(&plugin.dir_path));
            ui.end_row();

            ui.strong("Type");
            ui.label(plugin.plugin_type.to_string());
            ui.end_row();

            ui.strong("Directory");
            selectable_wrapped_label(ui, plugin.dir_path.display().to_string());
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
    let (rect, response) = ui.allocate_exact_size(size, Sense::click());

    if ui.is_rect_visible(rect) {
        let text_color = if selected || response.hovered() {
            ui.visuals().strong_text_color()
        } else {
            ui.visuals().text_color()
        };
        let tab_label = detail_tab_label(ui, label, issue_count, issue_color, text_color);
        let layout = ui.painter().layout_job(tab_label);
        let text_pos = pos2(rect.center().x - layout.size().x / 2.0, rect.min.y);
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
    let tab_label = detail_tab_label(
        ui,
        label,
        issue_count,
        issue_color,
        ui.visuals().text_color(),
    );
    let mut size = ui.painter().layout_job(tab_label).size();
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
    text.append(
        label,
        0.0,
        TextFormat {
            font_id: TextStyle::Body.resolve(ui.style()),
            color: text_color,
            ..Default::default()
        },
    );

    if issue_count > 0
        && let Some(color) = issue_color
    {
        text.append(
            &format!("({issue_count})"),
            3.0,
            TextFormat {
                font_id: TextStyle::Small.resolve(ui.style()),
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
    let underline = Rect::from_min_max(pos2(rect.left(), y), pos2(rect.right(), y + 2.0));
    ui.painter().rect_filled(
        underline,
        1.0,
        colors::main_accent_stroke(ui.visuals().dark_mode),
    );
}

fn render_empty_readme(ui: &mut Ui) {
    ui.label(RichText::new("This plugin does not include README content.").weak());
}

fn render_inspect(ui: &mut Ui, run_data: Option<&PluginRunData>) {
    let Some(run_data) = run_data else {
        ui.label(RichText::new("No run logs.").weak());
        return;
    };

    let (warnings, errors) = warning_error_counts(run_data);
    ui.horizontal(|ui| {
        ui.label(format!("Errors: {errors}"));
        ui.label(format!("Warnings: {warnings}"));
    });
    ui.add_space(6.0);

    if run_data.logs.is_empty() {
        ui.label(RichText::new("No run logs.").weak());
        return;
    }

    for log in &run_data.logs {
        ui.horizontal_wrapped(|ui| {
            let timestamp = Local
                .timestamp_opt(log.timestamp as i64, 0)
                .single()
                .map(|time| time.format("%Y-%m-%d %H:%M:%S").to_string())
                .unwrap_or_else(|| log.timestamp.to_string());

            ui.monospace(timestamp);

            let level = match log.level {
                PluginLogLevel::Err => "Error",
                PluginLogLevel::Warn => "Warning",
                PluginLogLevel::Debug => "Debug",
                PluginLogLevel::Info => "Info",
            };
            ui.label(level);
            Label::new(&log.msg).selectable(true).truncate().ui(ui);
        });
        ui.add_space(2.0);
    }
}

fn selectable_wrapped_label(ui: &mut Ui, text: String) {
    Label::new(text)
        .selectable(true)
        .wrap_mode(TextWrapMode::Wrap)
        .ui(ui);
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
