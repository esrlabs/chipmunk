use egui::{Id, Ui};
use tokio::sync::mpsc;
use uuid::Uuid;

use crate::{
    host::ui::UiActions,
    session::{command::SessionCommand, ui::shared::SessionShared},
};

#[derive(Debug)]
pub struct UdpObserveUi {
    id: Id,
    _cmd_txa: mpsc::Sender<SessionCommand>,
}

impl UdpObserveUi {
    pub fn new(id_salt: Uuid, cmd_tx: mpsc::Sender<SessionCommand>) -> Self {
        let id = Id::new(format!("side_udp_{id_salt}"));
        Self {
            id,
            _cmd_txa: cmd_tx,
        }
    }

    pub fn render_content(
        &mut self,
        ui: &mut Ui,
        _shared: &mut SessionShared,
        actions: &mut UiActions,
    ) {
        super::render_group_title(ui, "UDP Connections");

        ui.add_space(super::SPACE_BETWEEN_GROUPS);

        self.attach_udp(ui, actions);
    }

    fn attach_udp(&self, ui: &mut Ui, _actions: &mut UiActions) {
        super::render_attach_source(ui, self.id, "New Connection", |ui| {
            //TODO AAZ:
            ui.label("Attach new UDP Connections goes here");
        });
    }
}
