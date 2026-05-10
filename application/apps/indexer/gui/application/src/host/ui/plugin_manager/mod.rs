//! Plugin Manager host-tab UI.
//!
//! This module renders the native Plugin Manager from host-owned plugin state. It does not own
//! canonical plugin data or perform backend work.

mod details;
mod list;
mod readme;

use std::path::{Path, PathBuf};

use egui::{
    Align, CentralPanel, Frame, Layout, Panel, RichText, ScrollArea, Spinner, Ui, Widget, vec2,
};
use stypes::PluginEntity;
use tokio::sync::mpsc::Sender;

use crate::{
    common::ui::{
        RESIZABLE_PANEL_DEFAULT_SIZE, RESIZABLE_PANEL_MAX_SIZE, RESIZABLE_PANEL_MIN_SIZE, buttons,
    },
    host::{
        command::HostCommand,
        message::PluginReadmeLoaded,
        ui::{
            UiActions,
            actions::FileDialogOptions,
            state::{
                HostPreferences,
                modal::{ConfirmationAnswer, ConfirmationDialog, HostModal, HostModalState},
                plugin::{PluginsData, PluginsState},
            },
        },
    },
};

use self::{
    details::DetailsTab,
    readme::{ReadmeState, ReadmeStatus},
};

const ADD_PLUGIN_DIALOG_ID: &str = "plugin_manager_add_plugin";
const REMOVE_PLUGIN_CONFIRMATION_ID: &str = "plugin_manager_remove_plugin";

/// Closeable host-tab view for inspecting and managing plugins.
#[derive(Debug)]
pub struct PluginManagerView {
    cmd_tx: Sender<HostCommand>,
    selected_path: Option<PathBuf>,
    details_tab: DetailsTab,
    pending_remove_path: Option<PathBuf>,
    readme: ReadmeState,
}

impl PluginManagerView {
    /// Creates a Plugin Manager view that can send plugin operation commands.
    pub fn new(cmd_tx: Sender<HostCommand>) -> Self {
        Self {
            cmd_tx,
            selected_path: None,
            details_tab: DetailsTab::About,
            pending_remove_path: None,
            readme: ReadmeState::default(),
        }
    }

    /// Handles a README loading response from the host service.
    pub fn handle_readme_loaded(&mut self, response: PluginReadmeLoaded) {
        self.readme.handle_response(response);
    }

    /// Invalidates current README state when backend plugin state changes.
    pub fn handle_plugins_changed(&mut self, plugins: &PluginsState) {
        match plugins {
            PluginsState::Loading | PluginsState::Unavailable => self.readme.clear(),
            PluginsState::Available(data) => self.readme.retain_available(data),
        }
    }

    /// Renders the Plugin Manager shell for the current host plugin state.
    pub fn render_content(
        &mut self,
        ui: &mut Ui,
        plugins: &PluginsState,
        actions: &mut UiActions,
        preferences: &mut HostPreferences,
        modals: &mut HostModalState,
    ) {
        self.handle_pending_dialog(plugins, actions);
        self.handle_remove_confirmation(actions, modals);

        match plugins {
            PluginsState::Loading => render_loading(ui),
            PluginsState::Unavailable => render_unavailable(ui),
            PluginsState::Available(data) => {
                self.render_available(data, actions, preferences, modals, ui)
            }
        }
    }

    fn handle_pending_dialog(&mut self, plugins: &PluginsState, actions: &mut UiActions) {
        let Some(paths) = actions.file_dialog.take_output(ADD_PLUGIN_DIALOG_ID) else {
            return;
        };

        if !matches!(plugins, PluginsState::Available(_)) {
            return;
        }

        let Some(path) = paths.into_iter().next() else {
            return;
        };

        actions.try_send_command(&self.cmd_tx, HostCommand::AddPlugin { path });
    }

    fn handle_remove_confirmation(&mut self, actions: &mut UiActions, modals: &mut HostModalState) {
        let Some(answer) = modals.take_confirmation_result(REMOVE_PLUGIN_CONFIRMATION_ID) else {
            return;
        };

        match answer {
            ConfirmationAnswer::Confirmed => {
                if let Some(path) = self.pending_remove_path.take() {
                    actions.try_send_command(&self.cmd_tx, HostCommand::RemovePlugin { path });
                }
            }
            ConfirmationAnswer::Cancelled => {
                self.pending_remove_path = None;
            }
        }
    }

    fn render_available(
        &mut self,
        data: &PluginsData,
        actions: &mut UiActions,
        preferences: &mut HostPreferences,
        modals: &mut HostModalState,
        ui: &mut Ui,
    ) {
        self.clear_missing_selection(data);

        Panel::top("plugin_manager_header")
            .exact_size(40.0)
            .show_inside(ui, |ui| {
                ui.with_layout(Layout::right_to_left(Align::Center), |ui| {
                    if ui.add(buttons::session_setup("Reload", None)).clicked() {
                        actions.try_send_command(&self.cmd_tx, HostCommand::ReloadPlugins);
                    }

                    if ui.add(buttons::session_setup("Add Plugin", None)).clicked() {
                        actions.file_dialog.pick_folder(
                            ADD_PLUGIN_DIALOG_ID,
                            FileDialogOptions::new().title("Add Plugin"),
                        );
                    }

                    ui.with_layout(Layout::left_to_right(Align::Center), |ui| {
                        ui.heading("Plugin Manager");
                    });
                });
            });

        Panel::right("plugin_manager_sidebar")
            .frame(Frame::side_top_panel(ui.style()))
            .size_range(RESIZABLE_PANEL_MIN_SIZE..=RESIZABLE_PANEL_MAX_SIZE)
            .default_size(RESIZABLE_PANEL_DEFAULT_SIZE)
            .resizable(true)
            .show_animated_inside(ui, preferences.panels_visibility.right, |ui| {
                list::render_sidebar(self, data, modals, ui);
            });

        CentralPanel::default().show_inside(ui, |ui| {
            self.render_selected_details(data, actions, ui);
        });
    }

    fn render_selected_details(
        &mut self,
        data: &PluginsData,
        actions: &mut UiActions,
        ui: &mut Ui,
    ) {
        ui.add_space(12.0);

        let Some(selected_path) = self.selected_path.clone() else {
            self.readme.clear();
            ui.vertical_centered(|ui| {
                ui.label(RichText::new("Select a plugin from the sidebar.").weak());
            });
            return;
        };

        ScrollArea::vertical()
            .id_salt("plugin_manager_details_scroll")
            .show(ui, |ui| {
                if let Some(plugin) = data
                    .installed
                    .iter()
                    .find(|plugin| plugin.dir_path == selected_path)
                {
                    self.request_readme(plugin, actions);
                    let run_data = data.run_data.get(&plugin.dir_path);
                    self.render_installed_details(ui, plugin, run_data);
                    return;
                }

                if let Some(plugin) = data
                    .invalid
                    .iter()
                    .find(|plugin| plugin.dir_path == selected_path)
                {
                    self.readme.clear();
                    let run_data = data.run_data.get(&plugin.dir_path);
                    self.render_invalid_details(ui, plugin, run_data);
                }
            });
    }

    fn request_readme(&mut self, plugin: &PluginEntity, actions: &mut UiActions) {
        self.readme.reset_for(&plugin.dir_path);

        if self.details_tab != DetailsTab::About || plugin.readme_path.is_none() {
            return;
        }

        if !matches!(self.readme.status, ReadmeStatus::Idle) {
            return;
        }

        let request_id = self.readme.start_loading();
        let command = HostCommand::LoadPluginReadme {
            request_id,
            plugin_path: plugin.dir_path.clone(),
        };

        if !actions.try_send_command(&self.cmd_tx, command) {
            self.readme.status = ReadmeStatus::Error {
                message: "Failed to request README loading.".to_owned(),
            };
        }
    }

    fn open_remove_confirmation(&mut self, path: &Path, title: &str, modals: &mut HostModalState) {
        let dialog = ConfirmationDialog::new(
            REMOVE_PLUGIN_CONFIRMATION_ID,
            "Remove plugin",
            format!("Are you sure you want to permanently remove '{title}' plugin?"),
        )
        .with_confirm_label("Remove")
        .with_cancel_label("Cancel");

        if modals.open(HostModal::Confirmation(dialog)) {
            self.pending_remove_path = Some(path.to_path_buf());
        }
    }

    fn clear_missing_selection(&mut self, data: &PluginsData) {
        let Some(selected_path) = self.selected_path.as_deref() else {
            return;
        };

        let exists = data
            .installed
            .iter()
            .any(|plugin| plugin.dir_path == selected_path)
            || data
                .invalid
                .iter()
                .any(|plugin| plugin.dir_path == selected_path);

        if !exists {
            self.selected_path = None;
        }
    }
}

/// Renders the loading state while the host service initializes or updates plugins.
fn render_loading(ui: &mut Ui) {
    ui.allocate_ui_with_layout(
        vec2(ui.available_width(), ui.available_height()),
        Layout::top_down(Align::Center),
        |ui| {
            ui.add_space(24.0);
            ui.label(RichText::new("Loading plugins...").strong());
            ui.add_space(12.0);
            Spinner::new().size(23.).ui(ui);
        },
    );
}

/// Renders the unavailable state after plugin manager startup fails.
fn render_unavailable(ui: &mut Ui) {
    ui.allocate_ui_with_layout(
        vec2(ui.available_width(), ui.available_height()),
        Layout::top_down(Align::Center),
        |ui| {
            ui.add_space(24.0);
            ui.label(RichText::new("Plugin manager is unavailable.").strong());
            ui.label("Plugin operations are disabled because plugin manager startup failed.");
        },
    );
}
