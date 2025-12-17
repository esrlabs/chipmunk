use egui::{MenuBar, Ui};
use tokio::sync::mpsc::Sender;

use crate::host::{command::HostCommand, ui::actions::UiActions};

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

            ui.menu_button("Terminal", |ui| {
                if ui.button("Execute Command").clicked() {
                    actions.try_send_command(&self.cmd_tx, HostCommand::OpenProcessCommand);
                }
            });
        });
    }
}
