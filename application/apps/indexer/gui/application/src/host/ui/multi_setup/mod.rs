use egui::{Align, Button, CentralPanel, Frame, Layout, SidePanel, TopBottomPanel, Ui, Widget};
use tokio::sync::mpsc;
use uuid::Uuid;

use crate::host::{
    command::HostCommand,
    ui::{UiActions, multi_setup::state::MultiFileState},
};

use side_panel::MultiSidePanel;

mod main_table;
mod side_panel;
pub mod state;

#[derive(Debug)]
pub struct MultiFileSetup {
    pub state: MultiFileState,
    cmd_tx: mpsc::Sender<HostCommand>,
    side_panel: MultiSidePanel,
}

impl MultiFileSetup {
    pub fn new(state: MultiFileState, cmd_tx: mpsc::Sender<HostCommand>) -> Self {
        Self {
            state,
            cmd_tx,
            side_panel: MultiSidePanel::default(),
        }
    }

    pub fn id(&self) -> Uuid {
        self.state.id()
    }

    pub fn close(&self, actions: &mut UiActions) {
        actions.try_send_command(&self.cmd_tx, HostCommand::CloseMultiSetup(self.id()));
    }

    pub fn render_content(&mut self, actions: &mut UiActions, ui: &mut Ui) {
        TopBottomPanel::top("actions panel")
            .exact_height(40.)
            .show_inside(ui, |ui| {
                ui.with_layout(Layout::right_to_left(Align::Center), |ui| {
                    self.top_panel(actions, ui);
                });
            });

        SidePanel::right("side info")
            .frame(Frame::central_panel(ui.style()))
            .width_range(200.0..=350.0)
            .default_width(250.)
            .resizable(true)
            .show_inside(ui, |ui| {
                ui.with_layout(Layout::top_down_justified(Align::LEFT), |ui| {
                    self.side_panel.render_content(ui, &mut self.state);
                });
            });

        CentralPanel::default().show_inside(ui, |ui| {
            main_table::render_content(ui, &mut self.state);
        });
    }

    fn top_panel(&mut self, actions: &mut UiActions, ui: &mut Ui) {
        if Button::new("Cancel").ui(ui).clicked() {
            self.close(actions);
        }

        let active_count = self
            .state
            .files
            .iter()
            .filter(|f| f.included)
            .take(2) // No need to continue if we already have two.
            .count();

        if ui
            .add_enabled(active_count > 1, Button::new("Concat"))
            .clicked()
        {
            let files = self
                .state
                .files
                .iter()
                .filter(|f| f.included)
                .map(|f| (f.path.to_owned(), f.format))
                .collect();

            let cmd = HostCommand::ConcatFiles(files);

            if actions.try_send_command(&self.cmd_tx, cmd) {
                self.close(actions);
            }
        }

        if ui
            .add_enabled(active_count > 0, Button::new("Open Each"))
            .clicked()
        {
            let files = self
                .state
                .files
                .iter()
                .filter(|f| f.included)
                .map(|f| f.path.to_owned())
                .collect();
            let cmd = HostCommand::OpenAsSessions(files);
            if actions.try_send_command(&self.cmd_tx, cmd) {
                self.close(actions);
            }
        }
    }
}
