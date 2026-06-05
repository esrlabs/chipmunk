use egui::{Button, MenuBar, Theme, Ui};
use stypes::FileFormat;
use tokio::sync::mpsc::Sender;

use crate::{
    common::app_info,
    host::{
        command::HostCommand,
        common::{app_style, parsers::ParserNames, sources::StreamNames},
        ui::{
            actions::UiActions,
            file_dialog_commands,
            state::{HostState, modal::HostModal},
            storage::HostStorage,
            tabs::HostTabs,
        },
    },
};

const MENU_MIN_SIZE: egui::Vec2 = egui::vec2(140.0, 0.0);

#[derive(Debug)]
pub struct MainMenuBar {
    cmd_tx: Sender<HostCommand>,
}

impl MainMenuBar {
    pub fn new(cmd_tx: Sender<HostCommand>) -> Self {
        Self { cmd_tx }
    }

    pub fn render(
        &mut self,
        ui: &mut Ui,
        actions: &mut UiActions,
        state: &mut HostState,
        tabs: &mut HostTabs,
        storage: &HostStorage,
    ) {
        self.handle_file_dialog(actions);

        MenuBar::new().ui(ui, |ui| {
            ui.menu_button(app_info::TITLE, |ui| {
                ui.set_min_size(MENU_MIN_SIZE);

                if cfg!(debug_assertions) {
                    ui.menu_button("Development", |ui| {
                        ui.set_min_size(MENU_MIN_SIZE);

                        if ui.button("Reset egui memory").clicked() {
                            ui.memory_mut(|mem| *mem = Default::default());
                            ui.global_style_mut(app_style::global_styles);
                        }
                    });

                    ui.separator();
                }

                if ui.button("Settings").clicked() {
                    tabs.open_app_settings(storage.settings.current().clone());
                    ui.close();
                }

                if ui.button("Keyboard Shortcuts").clicked() {
                    state.modals.open(HostModal::Shortcuts);
                    ui.close();
                }

                ui.separator();

                let update_check_running = state.app_info.is_checking_updates();
                let update_check_label = if update_check_running {
                    "Checking for Updates..."
                } else {
                    "Check for Updates..."
                };
                if ui
                    .add_enabled(!update_check_running, Button::new(update_check_label))
                    .clicked()
                {
                    if state.app_info.begin_update_check() {
                        let update_settings = storage.settings.current().updates.clone();
                        let command = HostCommand::CheckAppUpdates(Box::new(update_settings));
                        if !actions.try_send_command(&self.cmd_tx, command) {
                            state.app_info.cancel_update_check();
                        }
                    }
                    ui.close();
                }

                if ui.button("About").clicked() {
                    state.modals.open(HostModal::About);
                    ui.close();
                }

                ui.separator();

                if ui.button("Close").clicked() {
                    ui.send_viewport_cmd(egui::ViewportCommand::Close);
                }
            });

            ui.menu_button("File", |ui| {
                ui.set_min_size(MENU_MIN_SIZE);

                if ui.button("Open File(s)").clicked() {
                    file_dialog_commands::open_files_dialog(actions);
                }

                ui.separator();

                ui.menu_button("Select Files from Folder", |ui| {
                    ui.set_min_size(MENU_MIN_SIZE);

                    if ui.button("Text").clicked() {
                        file_dialog_commands::open_folder_dialog(actions, FileFormat::Text);
                    }
                    if ui.button("DLT Binary").clicked() {
                        file_dialog_commands::open_folder_dialog(actions, FileFormat::Binary);
                    }
                    if ui.button("PcapNG").clicked() {
                        file_dialog_commands::open_folder_dialog(actions, FileFormat::PcapNG);
                    }
                    if ui.button("Pcap").clicked() {
                        file_dialog_commands::open_folder_dialog(actions, FileFormat::PcapLegacy);
                    }
                });

                ui.separator();

                if ui.button("Open File(s) with Plugin...").clicked() {
                    file_dialog_commands::open_files_with_plugin_dialog(actions);
                }
            });

            ui.menu_button("Connections", |ui| {
                render_connections_menu(ui, actions, &self.cmd_tx);
            });

            ui.menu_button("Terminal", |ui| {
                ui.set_min_size(MENU_MIN_SIZE);

                if ui.button("Execute Command").clicked() {
                    actions.try_send_command(
                        &self.cmd_tx,
                        HostCommand::ConnectionSessionSetup {
                            stream: StreamNames::Process,
                            parser: ParserNames::Text,
                        },
                    );
                }
            });

            ui.menu_button("Plugins", |ui| {
                ui.set_min_size(MENU_MIN_SIZE);

                if ui.button("Plugin Manager").clicked() {
                    tabs.open_plugin_manager();
                    ui.close();
                }
            });

            ui.menu_button("View", |ui| {
                ui.set_min_size(MENU_MIN_SIZE);

                if ui.button("Dark Theme").clicked() {
                    ui.set_theme(Theme::Dark);
                }

                if ui.button("Light Theme").clicked() {
                    ui.set_theme(Theme::Light);
                }
            });
        });
    }

    fn handle_file_dialog(&mut self, actions: &mut UiActions) {
        file_dialog_commands::handle_dialog_output(actions, &self.cmd_tx);
    }
}

pub fn render_connections_menu(ui: &mut Ui, actions: &mut UiActions, cmd_tx: &Sender<HostCommand>) {
    ui.set_min_size(MENU_MIN_SIZE);

    if ui.button("DLT on UDP").clicked() {
        actions.try_send_command(
            cmd_tx,
            HostCommand::ConnectionSessionSetup {
                stream: StreamNames::Udp,
                parser: ParserNames::Dlt,
            },
        );
    }

    if ui.button("DLT on TCP").clicked() {
        actions.try_send_command(
            cmd_tx,
            HostCommand::ConnectionSessionSetup {
                stream: StreamNames::Tcp,
                parser: ParserNames::Dlt,
            },
        );
    }

    if ui.button("DLT on Serial Port").clicked() {
        actions.try_send_command(
            cmd_tx,
            HostCommand::ConnectionSessionSetup {
                stream: StreamNames::Serial,
                parser: ParserNames::Dlt,
            },
        );
    }

    ui.separator();

    if ui.button("Plain Text on Serial Port").clicked() {
        actions.try_send_command(
            cmd_tx,
            HostCommand::ConnectionSessionSetup {
                stream: StreamNames::Serial,
                parser: ParserNames::Text,
            },
        );
    }

    ui.separator();

    if ui.button("Select Source for Plain Text").clicked() {
        actions.try_send_command(
            cmd_tx,
            HostCommand::ConnectionSessionSetup {
                stream: StreamNames::Process,
                parser: ParserNames::Text,
            },
        );
    }

    if ui.button("Select Source for DLT").clicked() {
        actions.try_send_command(
            cmd_tx,
            HostCommand::ConnectionSessionSetup {
                stream: StreamNames::Udp,
                parser: ParserNames::Dlt,
            },
        );
    }

    ui.separator();

    if ui.button("Select Source for Plugins").clicked() {
        actions.try_send_command(
            cmd_tx,
            HostCommand::ConnectionSessionSetup {
                stream: StreamNames::Tcp,
                parser: ParserNames::Plugins,
            },
        );
    }
}
