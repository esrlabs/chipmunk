//! Home-screen layout and panel composition.

use egui::{Align, CentralPanel, Layout, Margin, Panel, Ui, vec2};
use tokio::sync::mpsc::Sender;

use self::{file_explorer::FileExplorerUi, recent::RecentSessionsUi};
use super::menu::render_connections_menu;
use crate::common::phosphor::icons;
use crate::host::{
    command::HostCommand,
    common::{parsers::ParserNames, sources::StreamNames, ui_utls::general_group_frame},
    ui::{UiActions, actions::FileDialogOptions, storage::HostStorage},
};

mod file_explorer;
mod recent;

const ACTION_FILES_ID: &str = "action_files";
const QUICK_ACTIONS_WIDTH: f32 = 45.0;

#[derive(Debug)]
pub struct HomeView {
    file_explorer: FileExplorerUi,
    recent_sessions: RecentSessionsUi,
    cmd_tx: Sender<HostCommand>,
}

impl HomeView {
    /// Creates the home view and its child panel controllers.
    pub fn new(cmd_tx: Sender<HostCommand>) -> Self {
        Self {
            file_explorer: FileExplorerUi::new(cmd_tx.clone()),
            recent_sessions: RecentSessionsUi::new(cmd_tx.clone()),
            cmd_tx,
        }
    }

    /// Renders the home screen and delegates each panel to its dedicated UI
    /// controller.
    pub fn render_content(
        &mut self,
        storage: &mut HostStorage,
        actions: &mut UiActions,
        ui: &mut Ui,
    ) {
        Panel::right("favorite folders")
            .size_range(250.0..=750.0)
            .default_size(350.)
            .resizable(true)
            .show_inside(ui, |ui| {
                self.file_explorer
                    .render_content(actions, &mut storage.file_explorer, ui);
            });

        CentralPanel::default().show_inside(ui, |ui| {
            let available_height = ui.available_height();

            ui.horizontal_top(|ui| {
                ui.allocate_ui_with_layout(
                    vec2(QUICK_ACTIONS_WIDTH, available_height),
                    Layout::top_down(Align::Center),
                    |ui| {
                        general_group_frame(ui)
                            .inner_margin(Margin::symmetric(0, 2))
                            .show(ui, |ui| {
                                ui.take_available_height();
                                ui.set_width(ui.available_width());
                                render_quick_actions(ui, actions, &self.cmd_tx);
                            });
                    },
                );

                ui.allocate_ui_with_layout(
                    vec2(ui.available_width(), available_height),
                    Layout::top_down(Align::Min),
                    |ui| {
                        general_group_frame(ui).show(ui, |ui| {
                            ui.take_available_width();
                            self.recent_sessions.render_content(
                                actions,
                                &mut storage.recent_sessions,
                                ui,
                            );
                        });
                    },
                );
            });
        });
    }
}

fn render_quick_actions(ui: &mut egui::Ui, actions: &mut UiActions, cmd_tx: &Sender<HostCommand>) {
    if let Some(paths) = actions.file_dialog.take_output(ACTION_FILES_ID)
        && !paths.is_empty()
    {
        actions.try_send_command(cmd_tx, HostCommand::OpenFiles(paths));
    }

    let item_size = egui::vec2(ui.available_width(), 44.0);

    egui::ScrollArea::vertical()
        .id_salt("quick_actions_scroll")
        .show(ui, |ui| {
            action_button(ui, item_size, icons::regular::FOLDER, "File(s)", || {
                actions.file_dialog.pick_files(
                    ACTION_FILES_ID,
                    FileDialogOptions::new().title("Open files(s)"),
                );
            });

            let connections_button = action_button(
                ui,
                item_size,
                icons::regular::PLUGS_CONNECTED,
                "Connections",
                || {},
            );

            egui::Popup::menu(&connections_button).show(|ui| {
                render_connections_menu(ui, actions, cmd_tx);
            });

            action_button(ui, item_size, icons::regular::TERMINAL, "Terminal", || {
                actions.try_send_command(
                    cmd_tx,
                    HostCommand::ConnectionSessionSetup {
                        stream: StreamNames::Process,
                        parser: ParserNames::Text,
                    },
                );
            });
        });
}

fn action_button(
    ui: &mut egui::Ui,
    size: egui::Vec2,
    icon: &str,
    label: &str,
    on_click: impl FnOnce(),
) -> egui::Response {
    ui.push_id(format!("quick_action_{}", label.to_lowercase()), |ui| {
        let (rect, response) = ui.allocate_exact_size(size, egui::Sense::click());

        let visuals = ui.style().interact(&response);

        if response.hovered() || response.is_pointer_button_down_on() {
            ui.painter()
                .rect_filled(rect.shrink(2.0), 6.0, visuals.bg_fill);
        }

        let inner_rect = rect.shrink(6.0);

        ui.scope_builder(egui::UiBuilder::new().max_rect(inner_rect), |ui| {
            ui.with_layout(
                egui::Layout::top_down_justified(egui::Align::Center),
                |ui| {
                    ui.add_space(2.0);
                    ui.label(egui::RichText::new(icon).size(22.0));
                },
            );
        });

        let response = response.on_hover_text(label);

        if response.clicked() {
            on_click();
        }

        ui.add_space(4.0);
        response
    })
    .inner
}
