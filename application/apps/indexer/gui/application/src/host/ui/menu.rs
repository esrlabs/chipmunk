use std::path::PathBuf;

use egui::{MenuBar, Ui};
use tokio::sync::mpsc::Sender;

use crate::host::{command::HostCommand, ui::ui_actions::UiActions};

#[derive(Debug)]
pub struct MainMenuBar {}

impl MainMenuBar {
    pub fn new() -> Self {
        Self {}
    }

    pub fn render(&mut self, ui: &mut Ui, cmd_tx: &Sender<HostCommand>, actions: &mut UiActions) {
        MenuBar::new().ui(ui, |ui| {
            ui.menu_button("Chipmunk", |ui| {
                if ui.button("Close").clicked() {
                    actions.try_send_command(cmd_tx, HostCommand::Close);
                }
            });

            ui.menu_button("File", |ui| {
                if ui.button("Open File(s)").clicked() {
                    //TODO AAZ: App shouldn't be usable while dialog open.

                    let handle = rfd::AsyncFileDialog::new().pick_files();

                    let cmd_tx = cmd_tx.to_owned();
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
