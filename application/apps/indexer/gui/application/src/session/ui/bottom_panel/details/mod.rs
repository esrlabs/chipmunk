use egui::{Label, RichText, Ui, Widget};
use processor::grabber::LineRange;
use tokio::sync::oneshot;

use crate::session::{
    command::SessionBlockingCommand, communication::UiSenders, data::SessionDataState,
};

#[derive(Debug, Default)]
pub struct DetailsUI {}

impl DetailsUI {
    pub fn render_content(&mut self, data: &SessionDataState, ui: &mut Ui) {
        let Some(log) = &data.selected_log else {
            return;
        };

        ui.add_space(10.);

        Label::new(format!("Row #: {}", log.pos))
            .selectable(false)
            .ui(ui);

        ui.add_space(10.);

        let content = RichText::new(&log.content).strong();
        Label::new(content).ui(ui);
    }

    fn load_content(pos: u64, senders: &UiSenders) -> Option<String> {
        let (elems_tx, elems_rx) = oneshot::channel();
        let cmd = SessionBlockingCommand::GrabLines {
            range: LineRange::from(pos..=pos),
            sender: elems_tx,
        };

        if senders.block_cmd_tx.blocking_send(cmd).is_err() {
            log::warn!("Communication error while sending grab command.");
            return None;
        };

        elems_rx
            .blocking_recv()
            .ok()
            .and_then(|items| items.into_iter().next())
            .map(|m| m.content)
    }
}
