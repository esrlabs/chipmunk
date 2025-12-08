mod state;

use egui::{
    Align, Button, CentralPanel, ComboBox, Label, Layout, RichText, SidePanel, TopBottomPanel, Ui,
    Widget,
};
pub use state::*;
use tokio::sync::mpsc::Sender;
use uuid::Uuid;

use crate::host::{
    command::HostCommand,
    common::{parsers::ParserNames, sources::ByteSourceType},
    ui::UiActions,
};

mod side_config;

#[derive(Debug)]
pub struct SessionSetup {
    pub state: SessionSetupState,
    cmd_tx: Sender<HostCommand>,
    selected_parser: ParserNames,
}

impl SessionSetup {
    pub fn new(state: SessionSetupState, cmd_tx: Sender<HostCommand>) -> Self {
        let selected_parser = ParserNames::from(&state.parser);

        Self {
            state,
            cmd_tx,
            selected_parser,
        }
    }

    #[inline]
    pub fn id(&self) -> Uuid {
        self.state.id
    }

    pub fn title(&self) -> &str {
        match &self.state.source {
            ByteSourceType::File(info) => info.name.as_str(),
        }
    }

    pub fn close(&self, actions: &mut UiActions) {
        actions.try_send_command(&self.cmd_tx, HostCommand::CloseSessionSetup(self.id()));
    }

    pub fn render_content(&mut self, actions: &mut UiActions, ui: &mut Ui) {
        TopBottomPanel::top("selection_panel")
            .exact_height(40.)
            .show_inside(ui, |ui| {
                ui.with_layout(Layout::right_to_left(Align::Center), |ui| {
                    self.top_bar(actions, ui);
                });
            });

        SidePanel::right("side options")
            .width_range(150.0..=250.0)
            .resizable(true)
            .show_inside(ui, |ui| {
                self.render_side_config(ui);
            });

        CentralPanel::default().show_inside(ui, |ui| {
            ui.centered_and_justified(|ui| {
                ui.heading("Main Configurations");
            });
        });
    }

    fn top_bar(&mut self, actions: &mut UiActions, ui: &mut Ui) {
        if Button::new("Cancel").ui(ui).clicked() {
            self.close(actions);
        }

        if ui
            .add_enabled(self.state.is_valid(), Button::new("Open"))
            .clicked()
        {
            self.state.start_session(&self.cmd_tx, actions);
        }

        ui.add_space(10.);

        let parser = self.selected_parser;
        ComboBox::from_label("Parser")
            .selected_text(self.selected_parser.to_string())
            .width(120.)
            .show_ui(ui, |ui| {
                for parser in &self.state.supported_parsers {
                    ui.selectable_value(&mut self.selected_parser, *parser, parser.to_string());
                }
            });

        let changed = parser != self.selected_parser;
        if changed {
            self.state.update_parser(self.selected_parser);
        }

        ui.add_space(10.);

        match &self.state.source {
            ByteSourceType::File(source_file_info) => {
                Label::new(format!("({})", source_file_info.size_txt)).ui(ui);
                Label::new(RichText::new(source_file_info.name.as_str()).strong()).ui(ui);
            }
        }
    }
}
