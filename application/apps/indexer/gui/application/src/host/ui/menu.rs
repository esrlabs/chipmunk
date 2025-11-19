use std::path::PathBuf;

use egui::{MenuBar, Ui};
use tokio::sync::mpsc::Sender;

use crate::host::{command::HostCommand, ui::ui_actions::UiActions};

#[derive(Debug)]
pub struct MainMenuBar {
    cmd_tx: Sender<HostCommand>,
}

impl MainMenuBar {
    pub fn new(cmd_tx: Sender<HostCommand>) -> Self {
        Self { cmd_tx }
    }

    pub fn render(&mut self, ui: &mut Ui, actions: &mut UiActions) {
        MenuBar::new().ui(ui, |ui| {
            ui.menu_button("Chipmunk", |ui| {
                if ui.button("Close").clicked() {
                    actions.try_send_command(&self.cmd_tx, HostCommand::Close);
                }
            });

            ui.menu_button("File", |ui| {
                if ui.button("Open File(s)").clicked() {
                    //TODO AAZ: App shouldn't be usable while dialog open.

                    let handle = rfd::AsyncFileDialog::new().pick_files();

                    let cmd_tx = self.cmd_tx.clone();
                    tokio::spawn(async move {
                        if let Some(files) = handle.await {
                            log::trace!("Open file dialog return with {files:?}");

                            if files.is_empty() {
                                return;
                            }

                            let files: Vec<PathBuf> =
                                files.iter().map(|file| file.into()).collect();

                            if let Err(err) = cmd_tx.send(HostCommand::OpenFiles(files)).await {
                                log::error!("Send app command failed: {err:?}");
                            }
                        }
                    });
                }
            })
        });
    }
}
