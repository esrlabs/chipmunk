//! Home-screen layout and panel composition.

use egui::{Align, CentralPanel, Layout, Margin, Panel, Ui, vec2};
use tokio::sync::mpsc::Sender;

use self::{file_explorer::FileExplorerUi, recent::RecentSessionsUi};
use super::menu::render_connections_menu;
use crate::common::phosphor::icons;
use crate::host::{
    command::HostCommand,
    common::{parsers::ParserNames, sources::StreamNames, ui_utls::general_group_frame},
    ui::{
        UiActions,
        actions::FileDialogOptions,
        state::PanelsVisibility,
        storage::{HostStorage, RecentSessionsStorage},
    },
};

mod file_explorer;
mod recent;

const ACTION_FILES_ID: &str = "action_files";
const QUICK_ACTIONS_WIDE_WIDTH: f32 = 274.0;
const RECENT_SESSIONS_MAX_WIDTH: f32 = 720.0;
const PANEL_GAP_WIDTH: f32 = 4.0;
const WIDE_LAYOUT_WIDTH: f32 =
    QUICK_ACTIONS_WIDE_WIDTH + RECENT_SESSIONS_MAX_WIDTH + (PANEL_GAP_WIDTH * 3.);

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
        panels_visibility: &PanelsVisibility,
        ui: &mut Ui,
    ) {
        self.handle_pending_file_dialog(actions);

        Panel::right("favorite folders")
            .size_range(100.0..=750.0)
            .default_size(350.)
            .resizable(true)
            .show_animated_inside(ui, panels_visibility.right, |ui| {
                self.file_explorer
                    .render_content(actions, &mut storage.file_explorer, ui);
            });

        CentralPanel::default().show_inside(ui, |ui| {
            // Layout rules:
            // - Wide views show the horizontal quick actions and center them with recent sessions.
            // - Smaller views switch to the narrow quick-actions rail and let recent sessions
            //   fill the remaining width.
            let available_height = ui.available_height();
            let show_wide_quick_actions = ui.available_width() >= WIDE_LAYOUT_WIDTH;

            if show_wide_quick_actions {
                // Center the fixed-width quick-actions + recent-sessions block as one unit.

                ui.with_layout(Layout::top_down(Align::Center), |ui| {
                    ui.allocate_ui_with_layout(
                        vec2(WIDE_LAYOUT_WIDTH, available_height),
                        Layout::left_to_right(Align::Min),
                        |ui| {
                            self.render_wide_quick_actions(ui, actions);
                            self.render_recent_sessions_panel(
                                ui,
                                &mut storage.recent_sessions,
                                actions,
                                RECENT_SESSIONS_MAX_WIDTH,
                                available_height,
                            );
                        },
                    );
                });
            } else {
                // In compact mode the actions collapse to a narrow rail and recent sessions take the rest.
                ui.horizontal_top(|ui| {
                    self.render_compact_quick_actions(ui, actions);
                    self.render_recent_sessions_panel(
                        ui,
                        &mut storage.recent_sessions,
                        actions,
                        ui.available_width(),
                        available_height,
                    );
                });
            }
        });
    }

    fn handle_pending_file_dialog(&self, actions: &mut UiActions) {
        if let Some(paths) = actions.file_dialog.take_output(ACTION_FILES_ID)
            && !paths.is_empty()
        {
            actions.try_send_command(&self.cmd_tx, HostCommand::OpenFiles(paths));
        }
    }

    // Width is chosen by the outer layout: fixed in wide mode, remaining space in compact mode.
    fn render_recent_sessions_panel(
        &mut self,
        ui: &mut Ui,
        recent_sessions: &mut RecentSessionsStorage,
        actions: &mut UiActions,
        width: f32,
        height: f32,
    ) {
        ui.allocate_ui_with_layout(vec2(width, height), Layout::top_down(Align::Min), |ui| {
            general_group_frame(ui).show(ui, |ui| {
                ui.take_available_width();
                self.recent_sessions
                    .render_content(actions, recent_sessions, ui);
            });
        });
    }

    fn render_wide_quick_actions(&self, ui: &mut egui::Ui, actions: &mut UiActions) {
        ui.allocate_ui(vec2(QUICK_ACTIONS_WIDE_WIDTH, 0.0), |ui| {
            general_group_frame(ui)
                .inner_margin(Margin::same(8))
                .show(ui, |ui| {
                    let button_size = egui::vec2(80.0, 72.0);

                    ui.horizontal_centered(|ui| {
                        action_button(
                            ui,
                            button_size,
                            icons::regular::FOLDER,
                            "File(s)",
                            true,
                            || {
                                actions.file_dialog.pick_files(
                                    ACTION_FILES_ID,
                                    FileDialogOptions::new().title("Open files(s)"),
                                );
                            },
                        );

                        let connections_button = action_button(
                            ui,
                            button_size,
                            icons::regular::PLUGS_CONNECTED,
                            "Connections",
                            true,
                            || {},
                        );

                        egui::Popup::menu(&connections_button).show(|ui| {
                            render_connections_menu(ui, actions, &self.cmd_tx);
                        });

                        action_button(
                            ui,
                            button_size,
                            icons::regular::TERMINAL,
                            "Terminal",
                            true,
                            || {
                                actions.try_send_command(
                                    &self.cmd_tx,
                                    HostCommand::ConnectionSessionSetup {
                                        stream: StreamNames::Process,
                                        parser: ParserNames::Text,
                                    },
                                );
                            },
                        );
                    });
                });
        });
    }

    fn render_compact_quick_actions(&self, ui: &mut egui::Ui, actions: &mut UiActions) {
        const QUICK_ACTIONS_COMPACT_WIDTH: f32 = 55.0;

        ui.allocate_ui_with_layout(
            vec2(QUICK_ACTIONS_COMPACT_WIDTH, ui.available_height()),
            Layout::top_down(Align::Center),
            |ui| {
                general_group_frame(ui)
                    .inner_margin(Margin::same(4))
                    .show(ui, |ui| {
                        ui.take_available_height();
                        ui.set_width(ui.available_width());

                        const QUICK_ACTIONS_COMPACT_BUTTON_HEIGHT: f32 = 44.0;
                        let button_size =
                            egui::vec2(ui.available_width(), QUICK_ACTIONS_COMPACT_BUTTON_HEIGHT);

                        egui::ScrollArea::vertical()
                            .id_salt("quick_actions_scroll")
                            .show(ui, |ui| {
                                action_button(
                                    ui,
                                    button_size,
                                    icons::regular::FOLDER,
                                    "File(s)",
                                    false,
                                    || {
                                        actions.file_dialog.pick_files(
                                            ACTION_FILES_ID,
                                            FileDialogOptions::new().title("Open files(s)"),
                                        );
                                    },
                                );
                                ui.add_space(4.0);

                                let connections_button = action_button(
                                    ui,
                                    button_size,
                                    icons::regular::PLUGS_CONNECTED,
                                    "Connections",
                                    false,
                                    || {},
                                );
                                ui.add_space(4.0);

                                egui::Popup::menu(&connections_button).show(|ui| {
                                    render_connections_menu(ui, actions, &self.cmd_tx);
                                });

                                action_button(
                                    ui,
                                    button_size,
                                    icons::regular::TERMINAL,
                                    "Terminal",
                                    false,
                                    || {
                                        actions.try_send_command(
                                            &self.cmd_tx,
                                            HostCommand::ConnectionSessionSetup {
                                                stream: StreamNames::Process,
                                                parser: ParserNames::Text,
                                            },
                                        );
                                    },
                                );
                            });
                    });
            },
        );
    }
}

fn action_button(
    ui: &mut egui::Ui,
    size: egui::Vec2,
    icon: &str,
    label: &str,
    show_label: bool,
    on_click: impl FnOnce(),
) -> egui::Response {
    ui.push_id(format!("quick_action_{}", label.to_lowercase()), |ui| {
        let (rect, response) = ui.allocate_exact_size(size, egui::Sense::click());
        let response = response.on_hover_cursor(egui::CursorIcon::PointingHand);

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
                    ui.label(egui::RichText::new(icon).size(if show_label { 20.0 } else { 22.0 }));

                    if show_label {
                        ui.add_space(2.0);
                        ui.label(egui::RichText::new(label).size(12.0));
                    }
                },
            );
        });

        let response = response.on_hover_text(label);

        if response.clicked() {
            on_click();
        }

        response
    })
    .inner
}
