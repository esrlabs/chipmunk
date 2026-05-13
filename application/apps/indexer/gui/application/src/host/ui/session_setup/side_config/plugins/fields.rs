//! Schema-driven plugin configuration field widgets.

use std::path::PathBuf;

use egui::{
    Button, Color32, ComboBox, DragValue, Frame, Label, Margin, RichText, TextStyle, Ui, Widget,
};
use stypes::{PluginConfigSchemaItem, PluginConfigSchemaType, PluginConfigValue};

use crate::{
    common::phosphor::icons,
    host::ui::{
        UiActions,
        actions::{FileDialogFilter, FileDialogOptions},
        session_setup::state::parsers::PluginParserConfig,
    },
};

/// Renders one plugin config schema field and writes edits into plugin parser settings.
pub fn render_field(
    config: &mut PluginParserConfig,
    schema: &PluginConfigSchemaItem,
    actions: &mut UiActions,
    ui: &mut Ui,
) {
    let Some(value) = config.config_value_mut(schema) else {
        return;
    };

    match (&schema.input_type, value) {
        (PluginConfigSchemaType::Boolean(_), PluginConfigValue::Boolean(value)) => {
            ui.checkbox(value, field_title(schema));
        }
        (PluginConfigSchemaType::Integer(_), PluginConfigValue::Integer(value)) => {
            render_field_title(schema, ui);
            DragValue::new(value).ui(ui);
        }
        (PluginConfigSchemaType::Float(_), PluginConfigValue::Float(value)) => {
            render_field_title(schema, ui);
            DragValue::new(value).ui(ui);
        }
        (PluginConfigSchemaType::Text(_), PluginConfigValue::Text(value)) => {
            render_field_title(schema, ui);
            ui.text_edit_singleline(value);
        }
        (PluginConfigSchemaType::Directories, PluginConfigValue::Directories(paths)) => {
            render_field_title(schema, ui);
            render_directories(schema, paths, actions, ui);
        }
        (PluginConfigSchemaType::Files(extensions), PluginConfigValue::Files(paths)) => {
            render_field_title(schema, ui);
            render_files(schema, paths, extensions, actions, ui);
        }
        (PluginConfigSchemaType::Dropdown((options, _)), PluginConfigValue::Dropdown(value)) => {
            render_field_title(schema, ui);
            render_dropdown(schema, value, options, ui);
        }
        (PluginConfigSchemaType::Boolean(_), _)
        | (PluginConfigSchemaType::Integer(_), _)
        | (PluginConfigSchemaType::Float(_), _)
        | (PluginConfigSchemaType::Text(_), _)
        | (PluginConfigSchemaType::Directories, _)
        | (PluginConfigSchemaType::Files(_), _)
        | (PluginConfigSchemaType::Dropdown(_), _) => {}
    }

    if let Some(description) = &schema.description {
        let description_text = RichText::new(description).small();
        Label::new(description_text).truncate().ui(ui);
    }
}

fn render_directories(
    schema: &PluginConfigSchemaItem,
    paths: &mut Vec<PathBuf>,
    actions: &mut UiActions,
    ui: &mut Ui,
) {
    let dialog_id = format!("plugin_config_directory:{}", schema.id);

    if let Some(selected_paths) = actions.file_dialog.take_output(&dialog_id)
        && let Some(path) = selected_paths.into_iter().next()
    {
        add_selected_path(paths, path);
    }

    if ui.button("Add directory").clicked() {
        let title = format!("Select {} Directory", field_title(schema));
        let options = FileDialogOptions::new().title(title);

        actions.file_dialog.pick_folder(dialog_id, options);
    }

    render_path_list(paths, ui);
}

fn render_files(
    schema: &PluginConfigSchemaItem,
    paths: &mut Vec<PathBuf>,
    extensions: &[String],
    actions: &mut UiActions,
    ui: &mut Ui,
) {
    let dialog_id = format!("plugin_config_file:{}", schema.id);

    if let Some(selected_paths) = actions.file_dialog.take_output(&dialog_id) {
        for path in selected_paths {
            add_selected_path(paths, path);
        }
    }

    if ui.button("Add files").clicked() {
        let title = format!("Select {} Files", field_title(schema));
        let filters = file_filters(extensions);
        let options = FileDialogOptions::new().title(title).filters(filters);

        actions.file_dialog.pick_files(dialog_id, options);
    }

    render_path_list(paths, ui);
}

fn render_dropdown(
    schema: &PluginConfigSchemaItem,
    value: &mut String,
    options: &[String],
    ui: &mut Ui,
) {
    // Fallback to the first item if the current value isn't included in the options.
    *value = options
        .iter()
        .find(|option| option.as_str() == value)
        .or_else(|| options.first())
        .unwrap_or(value)
        .to_owned();

    ui.add_enabled_ui(!options.is_empty(), |ui| {
        ComboBox::from_id_salt(("plugin_config_dropdown", &schema.id))
            .selected_text(value.as_str())
            .width(ui.available_width())
            .show_ui(ui, |ui| {
                for option in options {
                    ui.selectable_value(value, option.clone(), option);
                }
            });
    });
}

fn render_path_list(paths: &mut Vec<PathBuf>, ui: &mut Ui) {
    let mut remove_idx = None;

    for (idx, path) in paths.iter().enumerate() {
        Frame::NONE
            .inner_margin(Margin::symmetric(4, 2))
            .stroke(ui.visuals().widgets.noninteractive.bg_stroke)
            .fill(ui.visuals().faint_bg_color)
            .corner_radius(4)
            .show(ui, |ui| {
                ui.horizontal(|ui| {
                    let name = path
                        .file_name()
                        .map(|name| name.to_string_lossy().into_owned())
                        .unwrap_or_else(|| path.display().to_string());
                    let remove_button_width = ui.spacing().interact_size.x;
                    let max_label_width = (ui.available_width() - remove_button_width).max(0.0);
                    let text_width = ui
                        .painter()
                        .layout_no_wrap(
                            name.clone(),
                            TextStyle::Body.resolve(ui.style()),
                            Color32::TRANSPARENT,
                        )
                        .size()
                        .x;
                    let label_width = text_width.min(max_label_width);
                    let label = Label::new(name).truncate().show_tooltip_when_elided(false);
                    ui.add_sized([label_width, ui.spacing().interact_size.y], label)
                        .on_hover_ui(|ui| {
                            ui.set_max_width(ui.spacing().tooltip_width);
                            ui.label(path.display().to_string());
                        });

                    let remove_icon = RichText::new(icons::regular::X);
                    let remove_button = Button::new(remove_icon).frame(false);
                    if remove_button.ui(ui).on_hover_text("Remove path").clicked() {
                        remove_idx = Some(idx);
                    }
                });
            });
    }

    if let Some(idx) = remove_idx {
        paths.remove(idx);
    }
}

/// Adds a selected file or directory path while keeping plugin config paths deduplicated.
fn add_selected_path(selected_paths: &mut Vec<PathBuf>, path: PathBuf) {
    if !selected_paths.iter().any(|selected| selected == &path) {
        selected_paths.push(path);
    }
}

fn file_filters(extensions: &[String]) -> Vec<FileDialogFilter> {
    let mut filters = extensions
        .iter()
        .map(|extension| FileDialogFilter::new(format!("({extension})"), vec![extension.clone()]))
        .collect::<Vec<_>>();
    filters.push(FileDialogFilter::new("All files (*)", vec!["*".to_owned()]));
    filters
}

fn render_field_title(schema: &PluginConfigSchemaItem, ui: &mut Ui) {
    let title = field_title(schema);

    Label::new(title).truncate().ui(ui);
}

fn field_title(schema: &PluginConfigSchemaItem) -> &str {
    if schema.title.is_empty() {
        schema.id.as_str()
    } else {
        schema.title.as_str()
    }
}
