//! Sidebar list rendering for the native Plugin Manager.

use std::path::Path;

use egui::{
    Frame, Label, Margin, RichText, ScrollArea, Sense, Sides, TextStyle, Ui, UiBuilder,
    Widget as _, containers::menu::MenuButton, vec2,
};
use stypes::PluginType;

use crate::{
    common::{phosphor::icons, ui::buttons},
    host::{
        common::ui_utls::truncate_path_to_width,
        ui::state::{modal::HostModalState, plugin::PluginsData},
    },
};

use super::{
    PluginManagerView,
    details::{DetailsTab, path_label, plugin_label},
};

/// Renders the Plugin Manager sidebar list for installed and invalid plugins.
pub fn render_sidebar(
    view: &mut PluginManagerView,
    data: &PluginsData,
    modals: &mut HostModalState,
    ui: &mut Ui,
) {
    ScrollArea::vertical()
        .id_salt("plugin_manager_sidebar_scroll")
        .show(ui, |ui| {
            const ROW_SPACING_INCREMENT: f32 = 1.0;

            ui.add_space(4.0);
            render_group_heading(ui, "Installed Plugins", data.installed.len());
            ui.add_space(4.0);

            if data.installed.is_empty() {
                let empty_text = RichText::new("No installed plugins.").weak();
                ui.label(empty_text);
            } else {
                ui.scope(|ui| {
                    ui.spacing_mut().item_spacing.y += ROW_SPACING_INCREMENT;
                    for plugin in &data.installed {
                        let title = plugin_label(&plugin.metadata.title, &plugin.dir_path);
                        let row = PluginRow {
                            path: &plugin.dir_path,
                            title,
                            description: plugin.metadata.description.as_deref(),
                            plugin_type: plugin.plugin_type,
                            default_tab: DetailsTab::About,
                        };
                        render_plugin_row(view, row, modals, ui);
                    }
                });
            }

            ui.add_space(12.0);
            ui.separator();
            ui.add_space(8.0);

            render_group_heading(ui, "Invalid Plugins", data.invalid.len());
            ui.add_space(4.0);

            if data.invalid.is_empty() {
                let empty_text = RichText::new("No invalid plugins.").weak();
                ui.label(empty_text);
            } else {
                ui.scope(|ui| {
                    ui.spacing_mut().item_spacing.y += ROW_SPACING_INCREMENT;
                    for plugin in &data.invalid {
                        let title = path_label(&plugin.dir_path);
                        let row = PluginRow {
                            path: &plugin.dir_path,
                            title,
                            description: None,
                            plugin_type: plugin.plugin_type,
                            default_tab: DetailsTab::Inspect,
                        };
                        render_plugin_row(view, row, modals, ui);
                    }
                });
            }
        });
}

fn render_group_heading(ui: &mut Ui, title: &str, count: usize) {
    const HEADING_SIZE: f32 = 16.0;

    ui.horizontal_wrapped(|ui| {
        let title_text = RichText::new(title).heading().size(HEADING_SIZE);
        ui.label(title_text);

        let count_text = RichText::new(format!("({count})"))
            .weak()
            .size(HEADING_SIZE);
        ui.label(count_text);
    });
}

/// Data needed to render one plugin sidebar row.
struct PluginRow<'a> {
    /// Plugin directory used for selection, tooltips, and remove actions.
    path: &'a Path,
    /// Display name shown as the row title.
    title: String,
    /// Optional secondary text; the path is shown when this is absent.
    description: Option<&'a str>,
    /// Plugin kind used to choose the row icon.
    plugin_type: PluginType,
    /// Details tab selected when the row is opened.
    default_tab: DetailsTab,
}

fn render_plugin_row(
    view: &mut PluginManagerView,
    row: PluginRow<'_>,
    modals: &mut HostModalState,
    ui: &mut Ui,
) {
    let PluginRow {
        path,
        title,
        description,
        plugin_type,
        default_tab,
    } = row;
    let selected = view
        .selected_path
        .as_deref()
        .is_some_and(|selected| selected == path);

    const ROW_VERTICAL_PADDING: f32 = 8.0;
    const ROW_HORIZONTAL_PADDING: f32 = 8.0;
    let content_height = 2.0 * ui.text_style_height(&TextStyle::Body);
    let row_height = content_height + ROW_VERTICAL_PADDING;
    let row_size = vec2(ui.available_width(), row_height);
    let row_sense = Sense::click();
    let (rect, response) = ui.allocate_exact_size(row_size, row_sense);

    let visuals = ui.visuals();
    let mut row_frame = Frame::group(ui.style())
        .fill(visuals.faint_bg_color)
        .inner_margin(Margin::symmetric(ROW_HORIZONTAL_PADDING as i8, 4));
    if selected {
        row_frame = row_frame
            .fill(visuals.widgets.active.bg_fill)
            .stroke(visuals.selection.stroke);
    } else if response.hovered() {
        row_frame = row_frame.fill(visuals.widgets.hovered.bg_fill);
    }

    let mut menu_clicked = false;
    let row_builder = UiBuilder::new().max_rect(rect);
    ui.scope_builder(row_builder, |ui| {
        row_frame.show(ui, |ui| {
            Sides::new()
                .shrink_left()
                .truncate()
                .height(content_height)
                .show(
                    ui,
                    |ui| {
                        const ROW_ICON_SIZE: f32 = 18.0;

                        let icon = plugin_icon(plugin_type);
                        let icon_text = RichText::new(icon).size(ROW_ICON_SIZE);
                        ui.label(icon_text);
                        ui.vertical(|ui| {
                            let title_text = RichText::new(&title).strong();
                            Label::new(title_text).truncate().ui(ui);
                            render_plugin_secondary(ui, description, path);
                        });
                    },
                    |ui| {
                        ui.add_space(4.0);
                        let dots_text =
                            RichText::new(icons::regular::DOTS_THREE_VERTICAL).size(18.0);
                        let dots_button = buttons::side_panel_row_icon(dots_text);
                        let menu_button = MenuButton::from_button(dots_button);
                        let (response, _) = menu_button
                            .ui(ui, |ui| render_plugin_menu(view, path, &title, modals, ui));
                        menu_clicked = response.clicked();
                        ui.add_space(4.0);
                    },
                );
        });
    });

    let clicked = response.clicked();
    let response = response.on_hover_ui(|ui| {
        ui.set_max_width(ui.spacing().tooltip_width);
        let path_text = path.display().to_string();
        ui.label(path_text);
    });
    response.context_menu(|ui| render_plugin_menu(view, path, &title, modals, ui));

    if clicked && !menu_clicked {
        view.selected_path = Some(path.to_path_buf());
        view.details_tab = default_tab;
    }
}

fn render_plugin_menu(
    view: &mut PluginManagerView,
    path: &Path,
    title: &str,
    modals: &mut HostModalState,
    ui: &mut Ui,
) {
    if ui.button("Remove").clicked() {
        view.open_remove_confirmation(path, title, modals);
        ui.close();
    }
}

fn plugin_icon(plugin_type: PluginType) -> &'static str {
    match plugin_type {
        PluginType::Parser => icons::regular::FILE_CODE,
        PluginType::ByteSource => icons::regular::PLUGS_CONNECTED,
    }
}

fn render_plugin_secondary(ui: &mut Ui, description: Option<&str>, path: &Path) {
    let description = description.filter(|description| !description.is_empty());
    if let Some(description) = description {
        let description_text = RichText::new(description).weak();
        Label::new(description_text).truncate().ui(ui);
        return;
    }

    let available_width = ui.available_width();
    let path_label = truncate_path_to_width(ui, path, available_width, TextStyle::Body);
    let path_text = RichText::new(path_label.text).weak();
    let response = Label::new(path_text)
        .truncate()
        .show_tooltip_when_elided(false)
        .ui(ui);

    if path_label.truncated {
        response.on_hover_ui(|ui| {
            ui.set_max_width(ui.spacing().tooltip_width);
            let path_text = path.display().to_string();
            ui.label(path_text);
        });
    }
}
