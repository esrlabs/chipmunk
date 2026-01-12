use egui::Ui;
use tokio::sync::mpsc;

use crate::session::{command::SessionCommand, ui::shared::SessionShared};

#[derive(Debug)]
pub struct FiltersUi {
    cmd_tx: mpsc::Sender<SessionCommand>,
}

impl FiltersUi {
    pub fn new(cmd_tx: mpsc::Sender<SessionCommand>) -> Self {
        Self { cmd_tx }
    }

    pub fn render_content(&mut self, shared: &mut SessionShared, ui: &mut Ui) {
        ui.centered_and_justified(|ui| ui.heading("Filters UI coming soon"));
    }
}
