use egui::Ui;
use tokio::sync::mpsc;

use crate::session::{command::SessionCommand, ui::shared::SessionShared};

#[allow(unused)]
#[derive(Debug)]
pub struct ObservingUi {
    cmd_tx: mpsc::Sender<SessionCommand>,
}

impl ObservingUi {
    pub fn new(cmd_tx: mpsc::Sender<SessionCommand>) -> Self {
        Self { cmd_tx }
    }

    pub fn render_content(&mut self, _shared: &mut SessionShared, ui: &mut Ui) {
        ui.centered_and_justified(|ui| ui.heading("Observing UI coming soon."));
    }
}
