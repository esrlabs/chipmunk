use egui::{MenuBar, Ui};
use tokio::sync::mpsc::Sender;

use crate::host::{
    command::HostCommand,
    common::{parsers::ParserNames, sources::StreamNames},
    ui::actions::UiActions,
};

#[derive(Debug)]
pub struct MainMenuBar {
    cmd_tx: Sender<HostCommand>,
}

impl MainMenuBar {
    pub fn new(cmd_tx: Sender<HostCommand>) -> Self {
        Self { cmd_tx }
    }

    pub fn render(&mut self, ui: &mut Ui, actions: &mut UiActions) {
        const OPEN_FILES_ID: &str = "menu_open_files";

        if let Some(files) = actions.file_dialog.take_output(OPEN_FILES_ID)
            && !files.is_empty()
        {
            actions.try_send_command(&self.cmd_tx, HostCommand::OpenFiles(files));
        }

        MenuBar::new().ui(ui, |ui| {
            ui.menu_button("Chipmunk", |ui| {
                if ui.button("Close").clicked() {
                    actions.try_send_command(&self.cmd_tx, HostCommand::Close);
                }
            });

            ui.menu_button("File", |ui| {
                if ui.button("Open File(s)").clicked() {
                    actions.file_dialog.pick_files(OPEN_FILES_ID, &[]);
                }
            });

            ui.menu_button("Connections", |ui| {
                if ui.button("DLT on UDP").clicked() {
                    actions.try_send_command(
                        &self.cmd_tx,
                        HostCommand::ConnectionSessionSetup {
                            stream: StreamNames::Udp,
                            parser: ParserNames::Dlt,
                        },
                    );
                }

                if ui.button("DLT on TCP").clicked() {
                    actions.try_send_command(
                        &self.cmd_tx,
                        HostCommand::ConnectionSessionSetup {
                            stream: StreamNames::Tcp,
                            parser: ParserNames::Dlt,
                        },
                    );
                }

                if ui.button("DLT on Serial Port").clicked() {
                    actions.try_send_command(
                        &self.cmd_tx,
                        HostCommand::ConnectionSessionSetup {
                            stream: StreamNames::Serial,
                            parser: ParserNames::Dlt,
                        },
                    );
                }

                ui.separator();

                if ui.button("Plain Text on Serial Port").clicked() {
                    actions.try_send_command(
                        &self.cmd_tx,
                        HostCommand::ConnectionSessionSetup {
                            stream: StreamNames::Serial,
                            parser: ParserNames::Text,
                        },
                    );
                }

                ui.separator();

                if ui.button("Select Source for Plain Text").clicked() {
                    actions.try_send_command(
                        &self.cmd_tx,
                        HostCommand::ConnectionSessionSetup {
                            stream: StreamNames::Process,
                            parser: ParserNames::Text,
                        },
                    );
                }

                if ui.button("Select Source for DLT").clicked() {
                    actions.try_send_command(
                        &self.cmd_tx,
                        HostCommand::ConnectionSessionSetup {
                            stream: StreamNames::Udp,
                            parser: ParserNames::Dlt,
                        },
                    );
                }
            });

            ui.menu_button("Terminal", |ui| {
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
        });
    }
}
