use egui::{MenuBar, Theme, Ui};
use stypes::FileFormat;
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

const OPEN_FILES_ID: &str = "menu_open_files";
const TEXT_FILES_FROM_DIR: &str = "menu_text_files";
const BINARY_DLT_FILES_FROM_DIR: &str = "menu_binary_dlt_files";
const PCAPNG_FILES_FROM_DIR: &str = "menu_pacpng_files";
const PCAP_FILES_FROM_DIR: &str = "menu_pcap_files";

impl MainMenuBar {
    pub fn new(cmd_tx: Sender<HostCommand>) -> Self {
        Self { cmd_tx }
    }

    pub fn render(&mut self, ui: &mut Ui, actions: &mut UiActions) {
        self.handle_file_dialog(actions);

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

                ui.separator();

                ui.menu_button("Select Files from Folder", |ui| {
                    if ui.button("Text").clicked() {
                        actions
                            .file_dialog
                            .pick_folder(id_from_file_format(FileFormat::Text));
                    }
                    if ui.button("DLT Binary").clicked() {
                        actions
                            .file_dialog
                            // NOTE: Binary is used here actually for DLT files to match the
                            // behavior in the master branch.
                            .pick_folder(id_from_file_format(FileFormat::Binary));
                    }
                    if ui.button("PcapNG").clicked() {
                        actions
                            .file_dialog
                            .pick_folder(id_from_file_format(FileFormat::PcapNG));
                    }
                    if ui.button("Pacp").clicked() {
                        actions
                            .file_dialog
                            .pick_folder(id_from_file_format(FileFormat::PcapLegacy));
                    }
                });
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

            ui.menu_button("View", |ui| {
                if ui.button("Dark Theme").clicked() {
                    ui.ctx().set_theme(Theme::Dark);
                }

                if ui.button("Light Theme").clicked() {
                    ui.ctx().set_theme(Theme::Light);
                }
            });
        });
    }

    fn handle_file_dialog(&mut self, actions: &mut UiActions) {
        if let Some((id, paths)) = actions.file_dialog.take_output_many(all_file_dialog_ids())
            && !paths.is_empty()
        {
            if id == OPEN_FILES_ID {
                actions.try_send_command(&self.cmd_tx, HostCommand::OpenFiles(paths));
                return;
            }

            if let Some(target_format) = file_format_from_id(id) {
                let dir_path = paths
                    .into_iter()
                    .next()
                    .expect("paths length is checked in parent if");
                let cmd = HostCommand::OpenFromDirectory {
                    dir_path,
                    target_format,
                };
                actions.try_send_command(&self.cmd_tx, cmd);
                return;
            }

            panic!("Menu: Not implemented dialog id {id}");
        }
    }
}

const fn all_file_dialog_ids() -> &'static [&'static str] {
    // Reminder on adding new file formats.
    match FileFormat::Text {
        FileFormat::PcapNG => {}
        FileFormat::PcapLegacy => {}
        FileFormat::Text => {}
        FileFormat::Binary => {}
    }

    &[
        OPEN_FILES_ID,
        TEXT_FILES_FROM_DIR,
        BINARY_DLT_FILES_FROM_DIR,
        PCAPNG_FILES_FROM_DIR,
        PCAP_FILES_FROM_DIR,
    ]
}

const fn id_from_file_format(format: FileFormat) -> &'static str {
    match format {
        FileFormat::PcapNG => PCAPNG_FILES_FROM_DIR,
        FileFormat::PcapLegacy => PCAP_FILES_FROM_DIR,
        FileFormat::Text => TEXT_FILES_FROM_DIR,
        FileFormat::Binary => BINARY_DLT_FILES_FROM_DIR,
    }
}

fn file_format_from_id(id: &str) -> Option<FileFormat> {
    // Reminder on adding new file formats.
    match FileFormat::Text {
        FileFormat::PcapNG => {}
        FileFormat::PcapLegacy => {}
        FileFormat::Text => {}
        FileFormat::Binary => {}
    }

    let format = match id {
        TEXT_FILES_FROM_DIR => FileFormat::Text,
        BINARY_DLT_FILES_FROM_DIR => FileFormat::Binary,
        PCAPNG_FILES_FROM_DIR => FileFormat::PcapNG,
        PCAP_FILES_FROM_DIR => FileFormat::PcapLegacy,
        _ => return None,
    };

    Some(format)
}
