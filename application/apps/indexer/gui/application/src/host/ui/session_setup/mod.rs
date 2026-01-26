use std::{borrow::Cow, ops::Deref};

use egui::{
    Align, Button, CentralPanel, ComboBox, Key, Label, Layout, Response, RichText, SidePanel,
    TopBottomPanel, Ui, Widget,
};
use tokio::sync::mpsc::Sender;
use uuid::Uuid;

use crate::host::{
    command::HostCommand,
    common::{file_utls, parsers::ParserNames, sources::StreamNames},
    ui::UiActions,
};
use state::{SessionSetupState, sources::ByteSourceConfig};

mod main_config;
mod side_config;
pub mod state;

#[derive(Debug)]
pub struct SessionSetup {
    pub state: SessionSetupState,
    cmd_tx: Sender<HostCommand>,
}

/// The outcome of render routines in children components of this view.
#[derive(Debug, Clone, Copy)]
enum RenderOutcome {
    StartSession,
    None,
}

impl SessionSetup {
    pub fn new(state: SessionSetupState, cmd_tx: Sender<HostCommand>) -> Self {
        Self { state, cmd_tx }
    }

    #[inline]
    pub fn id(&self) -> Uuid {
        self.state.id
    }

    pub fn title(&self) -> Cow<'_, str> {
        match &self.state.source {
            ByteSourceConfig::File(info) => info.name.as_str().into(),
            ByteSourceConfig::Concat(files) => format!("Concating {} files", files.len()).into(),
            ByteSourceConfig::Stream(..) => "Stream".into(),
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
            .width_range(200.0..=350.0)
            .default_width(250.)
            .resizable(true)
            .show_inside(ui, |ui| {
                ui.with_layout(Layout::top_down_justified(Align::LEFT), |ui| {
                    side_config::render_content(&mut self.state, actions, ui);
                });
            });

        CentralPanel::default().show_inside(ui, |ui| {
            ui.centered_and_justified(|ui| {
                let outcome = main_config::render_content(&mut self.state, actions, ui);
                match outcome {
                    RenderOutcome::StartSession => {
                        if self.state.is_valid() {
                            self.state.start_session(&self.cmd_tx, actions);
                        }
                    }
                    RenderOutcome::None => {}
                }
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

        let mut selected_parser = ParserNames::from(&self.state.parser);
        let original_parser = selected_parser;

        ComboBox::from_id_salt("Parser")
            .selected_text(selected_parser.to_string())
            .width(120.)
            .show_ui(ui, |ui| {
                for parser in Self::supported_parsers(&self.state.source) {
                    ui.selectable_value(&mut selected_parser, parser, parser.to_string());
                }
            });

        let changed = original_parser != selected_parser;
        if changed {
            self.state.update_parser(selected_parser);
        }

        Label::new("Used Parser:").selectable(false).ui(ui);

        ui.add_space(10.);

        match &mut self.state.source {
            ByteSourceConfig::File(source_file_info) => {
                if let Some(size) = &source_file_info.size_byte {
                    Label::new(format!("({})", file_utls::format_file_size(*size))).ui(ui);
                }
                Label::new(RichText::new(source_file_info.name.as_str()).strong()).ui(ui);
            }
            ByteSourceConfig::Concat(files) => {
                let size = files.iter().filter_map(|f| f.size_byte).sum();
                Label::new(format!("({})", file_utls::format_file_size(size))).ui(ui);

                Label::new(RichText::new(format!("{} files", files.len())).strong())
                    .selectable(false)
                    .ui(ui)
                    .on_hover_ui(|ui| {
                        files.iter().enumerate().for_each(|(idx, f)| {
                            if idx != 0 {
                                ui.separator();
                            }
                            Label::new(format!("{}", f.path.display())).ui(ui);
                        });
                    });
                Label::new("Concating:").selectable(false).ui(ui);
            }
            ByteSourceConfig::Stream(stream_config) => {
                let mut selected_stream = StreamNames::from(stream_config.deref());

                let original_stream = selected_stream;

                ComboBox::from_id_salt("stream")
                    .selected_text(selected_stream.to_string())
                    .width(120.)
                    .show_ui(ui, |ui| {
                        for stream in StreamNames::all()
                            .iter()
                            .filter(|s| s.is_compatible(selected_parser))
                        {
                            ui.selectable_value(&mut selected_stream, *stream, stream.to_string());
                        }
                    });

                if original_stream != selected_stream {
                    self.state.update_stream(selected_stream);
                }

                Label::new("Stream From:").selectable(false).ui(ui);
            }
        }
    }

    fn supported_parsers(source: &ByteSourceConfig) -> Vec<ParserNames> {
        match source {
            ByteSourceConfig::File(source_file_info) => ParserNames::all()
                .iter()
                .filter(|f| f.is_compatible_file(source_file_info.format))
                .copied()
                .collect(),
            ByteSourceConfig::Concat(files) => ParserNames::all()
                .iter()
                .filter(|f| f.is_compatible_file(files[0].format))
                .copied()
                .collect(),
            ByteSourceConfig::Stream(stream_config) => {
                let stream = StreamNames::from(stream_config);
                ParserNames::all()
                    .iter()
                    .filter(|p| p.is_compatible_stream(stream))
                    .copied()
                    .collect()
            }
        }
    }
}

/// Handles the "Enter" key press on a text field to trigger session startup with
/// consideration to if the configurations are valid.
fn start_session_on_enter<F>(text_res: &Response, is_valid: F, outcome: &mut RenderOutcome)
where
    F: FnOnce() -> bool,
{
    if text_res.lost_focus() && text_res.ctx.input(|ui| ui.key_pressed(Key::Enter)) {
        if is_valid() {
            *outcome = RenderOutcome::StartSession;
        } else {
            // Single line moves focus on enter. This is a quick fix
            // in case command isn't valid.
            text_res.request_focus();
        }
    }
}
