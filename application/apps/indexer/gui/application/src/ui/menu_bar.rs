use egui::{MenuBar, Ui};
use tokio::sync::mpsc::Sender;

use crate::core::commands::AppCommand;

#[derive(Debug)]
pub struct AppMenuBar {}

impl AppMenuBar {
    pub fn new() -> Self {
        Self {}
    }

    pub fn render(&mut self, ui: &mut Ui, cmd_tx: &Sender<AppCommand>) {
        MenuBar::new().ui(ui, |ui| {
            ui.menu_button("Chipmunk", |ui| {
                if ui.button("Close").clicked() {
                    if let Err(err) = cmd_tx.try_send(AppCommand::Close) {
                        // TODO AAZ: Better error handling.
                        log::error!("Send app command failed: {err:?}");
                    }
                }
            })
        });
    }
}
