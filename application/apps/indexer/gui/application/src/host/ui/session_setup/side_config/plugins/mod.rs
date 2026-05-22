//! Plugin parser side-panel rendering.
//!
//! The panel lists installed parser plugins and renders schema-driven config fields.

use std::path::Path;

use egui::{ComboBox, RichText, ScrollArea, Ui};
use stypes::{PluginEntity, PluginType};

use crate::host::ui::{
    UiActions,
    session_setup::state::parsers::PluginParserConfig,
    state::plugin::{PluginsData, PluginsState},
};

mod fields;

/// Renders the plugin parser selector and selected plugin configuration fields.
pub fn render_content(
    config: &mut PluginParserConfig,
    plugins: &PluginsState,
    actions: &mut UiActions,
    ui: &mut Ui,
) {
    match plugins {
        PluginsState::Loading => {
            ui.label(RichText::new("Loading plugins...").weak());
        }
        PluginsState::Unavailable => {
            ui.label(RichText::new("Plugin manager is unavailable.").weak());
        }
        PluginsState::Available(data) => render_available(config, data, actions, ui),
    }
}

fn render_available(
    config: &mut PluginParserConfig,
    data: &PluginsData,
    actions: &mut UiActions,
    ui: &mut Ui,
) {
    if !data
        .installed
        .iter()
        .any(|plugin| plugin.plugin_type == PluginType::Parser)
    {
        ui.label(RichText::new("No parser plugins are installed.").weak());
        return;
    }

    render_plugin_selector(config, data, ui);

    let Some(plugin) = config.resolved_plugin(data) else {
        if config.selected_settings().is_some() {
            ui.add_space(12.0);
            ui.label(RichText::new("Selected parser plugin is not installed.").weak());
        }
        return;
    };

    render_config_fields(config, plugin, actions, ui);
}

fn render_plugin_selector(config: &mut PluginParserConfig, data: &PluginsData, ui: &mut Ui) {
    let original_dir = config.selected_plugin_dir().map(Path::to_path_buf);
    let mut selected_dir = original_dir.clone();

    ComboBox::from_id_salt("plugin_parser_selector")
        .selected_text(selected_text(config, data))
        .width(ui.available_width())
        .show_ui(ui, |ui| {
            ui.selectable_value(&mut selected_dir, None, "Select parser plugin");

            for plugin in data
                .installed
                .iter()
                .filter(|plugin| plugin.plugin_type == PluginType::Parser)
            {
                ui.selectable_value(
                    &mut selected_dir,
                    Some(plugin.dir_path.clone()),
                    plugin_title(plugin),
                );
            }
        });

    if selected_dir != original_dir {
        if let Some(path) = selected_dir {
            if let Some(plugin) = data.installed.iter().find(|plugin| plugin.dir_path == path) {
                config.select_plugin(plugin);
            }
        } else {
            config.clear_selection();
        }
    }
}

fn render_config_fields(
    config: &mut PluginParserConfig,
    plugin: &PluginEntity,
    actions: &mut UiActions,
    ui: &mut Ui,
) {
    ui.add_space(12.0);
    ui.label(RichText::new("Configuration").strong());

    if plugin.info.config_schemas.is_empty() {
        ui.label("This plugin has no configuration.");
        return;
    }

    ScrollArea::vertical()
        .id_salt("plugin_config_scroll")
        .auto_shrink([false, true])
        .show(ui, |ui| {
            for (idx, schema) in plugin.info.config_schemas.iter().enumerate() {
                if idx > 0 {
                    ui.separator();
                }
                ui.add_space(8.0);
                fields::render_field(config, schema, actions, ui);
            }
        });
}

fn selected_text(config: &PluginParserConfig, data: &PluginsData) -> String {
    if let Some(plugin) = config.resolved_plugin(data) {
        return plugin_title(plugin);
    }

    config
        .selected_plugin_path()
        .map(|path| path.display().to_string())
        .unwrap_or_else(|| "Select parser plugin".to_owned())
}

fn plugin_title(plugin: &PluginEntity) -> String {
    if plugin.metadata.title.is_empty() {
        plugin
            .dir_path
            .file_name()
            .map(|name| name.to_string_lossy().into_owned())
            .unwrap_or_else(|| plugin.dir_path.display().to_string())
    } else {
        plugin.metadata.title.clone()
    }
}
