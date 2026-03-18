use egui::{ComboBox, RichText, Ui, Window};
use tokio::sync::mpsc;

use mcp::config::{AiConfig, LlmProvider};

use crate::common::phosphor::{self, icons};
use crate::session::{
    command::SessionCommand, message::AiMessage, types::FileMetadata, ui::shared::SessionShared,
};
use stypes::ObserveOrigin;

#[allow(unused)]
#[derive(Debug)]
pub struct ChatUi {
    cmd_tx: mpsc::Sender<SessionCommand>,
    text: String,
    history: Box<Vec<AiMessage>>,
    thinking: bool,
    show_config_popup: bool,
    model_name: String,
    provider: LlmProvider,
    url: String,
    api_key: String,
}

impl ChatUi {
    fn collect_file_metadata(shared: &SessionShared) -> Option<Vec<FileMetadata>> {
        let total_lines = shared.logs.logs_count;
        let entries: Vec<FileMetadata> = shared
            .observe
            .operations()
            .iter()
            .flat_map(|op| match &op.origin {
                ObserveOrigin::File(name, format, path) => vec![FileMetadata {
                    name: name.clone(),
                    file_type: FileMetadata::file_format_label(format).to_string(),
                    path: Some(path.clone()),
                    total_lines,
                }],
                ObserveOrigin::Concat(items) => items
                    .iter()
                    .map(|(name, format, path)| FileMetadata {
                        name: name.clone(),
                        file_type: FileMetadata::file_format_label(format).to_string(),
                        path: Some(path.clone()),
                        total_lines,
                    })
                    .collect(),
                ObserveOrigin::Stream(name, _) => vec![FileMetadata {
                    name: name.clone(),
                    file_type: String::from("Stream"),
                    path: None,
                    total_lines,
                }],
            })
            .collect();

        if entries.is_empty() {
            None
        } else {
            Some(entries)
        }
    }

    fn provider_label(provider: &LlmProvider) -> &'static str {
        match provider {
            LlmProvider::Ollama => "Ollama",
            LlmProvider::OpenAI => "OpenAI",
            LlmProvider::Antropic => "Anthropic",
            LlmProvider::Gemini => "Gemini",
            LlmProvider::Custom => "Custom",
        }
    }

    pub fn new(cmd_tx: mpsc::Sender<SessionCommand>) -> Self {
        let resp = AiMessage::Response(
            "Hello! I'm your AI assistant. How can I help you analyze the logs today?".to_string(),
        );
        let ai_config = AiConfig::default();
        Self {
            cmd_tx,
            text: String::new(),
            history: Box::new(vec![resp]),
            thinking: false,
            show_config_popup: false,
            model_name: ai_config.model.clone(),
            provider: ai_config.provider,
            url: ai_config.url.clone(),
            api_key: ai_config.api_key.clone().unwrap_or_default(),
        }
    }

    pub fn add_message(&mut self, message: AiMessage) {
        self.history.push(message);
    }

    pub fn toggle_thinking(&mut self) {
        self.thinking = !self.thinking;
    }

    pub fn render_content(&mut self, shared: &mut SessionShared, ui: &mut Ui) {
        ui.vertical(|ui| {
            let gear = RichText::new(icons::regular::GEAR)
                .family(phosphor::fill_font_family())
                .size(16.);
            ui.horizontal(|ui| {
                ui.heading("Analyze with AI");
                ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                    if ui.button(gear).clicked() {
                        self.show_config_popup = !self.show_config_popup;
                    }
                });
            });
            ui.separator();

            // Reserve a fixed-height input area at the bottom and give the rest to scrolling.
            let input_height = 48.0;
            let spacing = 8.0;
            let scroll_height = (ui.available_height() - input_height - spacing).max(120.0);

            ui.allocate_ui_with_layout(
                egui::vec2(ui.available_width(), scroll_height),
                egui::Layout::bottom_up(egui::Align::Min),
                |ui| {
                    egui::ScrollArea::vertical()
                        .auto_shrink([false; 2])
                        .stick_to_bottom(true)
                        .show(ui, |ui| {
                            ui.vertical(|ui| {
                                for message in self.history.iter() {
                                    match message {
                                        AiMessage::Prompt(text) => {
                                            ui.with_layout(
                                                egui::Layout::right_to_left(egui::Align::BOTTOM),
                                                |ui| {
                                                    ui.add(
                                                        egui::Label::new(
                                                            egui::RichText::new(text).color(
                                                                ui.visuals()
                                                                    .widgets
                                                                    .active
                                                                    .fg_stroke
                                                                    .color,
                                                            ),
                                                        )
                                                        .wrap(),
                                                    );
                                                },
                                            );
                                        }
                                        AiMessage::Response(text) => {
                                            ui.with_layout(
                                                egui::Layout::left_to_right(egui::Align::BOTTOM),
                                                |ui| {
                                                    ui.add(egui::Label::new(text).wrap());
                                                },
                                            );
                                        }
                                    }
                                    ui.add_space(12.0);
                                }
                                if self.thinking {
                                    ui.horizontal(|ui| {
                                        ui.spinner();
                                        ui.label(
                                            egui::RichText::new("Analysing…")
                                                .italics()
                                                .color(ui.visuals().weak_text_color()),
                                        );
                                    });
                                    ui.add_space(12.0);
                                }
                            });
                        });
                },
            );

            ui.add_space(spacing);
            ui.separator();

            // Fixed chat input area (outside scroll area).
            ui.horizontal(|ui| {
                let response = ui.add_sized(
                    [ui.available_width() - 60.0, input_height],
                    egui::TextEdit::singleline(&mut self.text).hint_text("Type a prompt..."),
                );

                if (ui.button("Send").clicked()
                    || (response.lost_focus() && ui.input(|i| i.key_pressed(egui::Key::Enter))))
                    && !self.text.trim().is_empty()
                {
                    let mut message = self.text.clone();
                    self.history.push(AiMessage::Prompt(message.clone()));
                    self.text.clear();

                    let file_metadata = Self::collect_file_metadata(shared);
                    if let Some(metadata) = file_metadata {
                        message = format!(
                            "{}\n\nFile Metadata: {:?}",
                            message,
                            metadata
                                .iter()
                                .map(|m| m.as_chat_message())
                                .collect::<Vec<String>>()
                        );
                    }
                    let _ = self.cmd_tx.try_send(SessionCommand::SendChatMessage {
                        id: shared.get_id(),
                        message,
                        history: self.history.clone(),
                        ai_config: shared.ai_configuration.clone(),
                    });
                    self.thinking = true;
                }
            });
        });

        // Render the configuration window
        if self.show_config_popup {
            let mut is_open = true;
            let mut should_close = false;
            Window::new("AI Configuration")
                .open(&mut is_open)
                .collapsible(false)
                .resizable(false)
                .show(ui.ctx(), |ui| {
                    should_close = self.render_config_popup(ui, shared);
                });
            if !is_open || should_close {
                self.show_config_popup = false;
            }
        }
    }

    fn render_config_popup(&mut self, ui: &mut Ui, shared: &mut SessionShared) -> bool {
        let mut should_close = false;
        ui.set_min_width(300.0);
        ui.vertical(|ui| {
            // Provider field
            ComboBox::from_label("Provider")
                .selected_text(Self::provider_label(&self.provider))
                .show_ui(ui, |ui| {
                    ui.selectable_value(&mut self.provider, LlmProvider::Ollama, "Ollama");
                    ui.selectable_value(&mut self.provider, LlmProvider::OpenAI, "OpenAI");
                    ui.selectable_value(&mut self.provider, LlmProvider::Gemini, "Gemini");
                    ui.selectable_value(&mut self.provider, LlmProvider::Antropic, "Anthropic");
                    ui.selectable_value(&mut self.provider, LlmProvider::Custom, "Custom");
                });
            ui.add_space(8.0);

            ui.label("URL");
            ui.text_edit_singleline(&mut self.url);
            ui.add_space(8.0);

            // Model Name field
            ui.label("Model Name");
            ui.text_edit_singleline(&mut self.model_name);
            ui.add_space(8.0);

            // API Key field (Optional)
            ui.label("API Key (Optional)");
            ui.text_edit_singleline(&mut self.api_key);
            ui.add_space(12.0);

            // Action buttons
            ui.horizontal(|ui| {
                if ui.button("Save").clicked() {
                    // Here you can emit a command or update state with the configuration
                    shared.update_ai_configuration(
                        self.provider.clone(),
                        self.model_name.clone(),
                        self.url.clone(),
                        if self.api_key.trim().is_empty() {
                            None
                        } else {
                            Some(self.api_key.clone())
                        },
                    );
                    should_close = true;
                }
                if ui.button("Cancel").clicked() {
                    self.provider = shared.ai_configuration.provider.clone();
                    self.model_name = shared.ai_configuration.model.clone();
                    self.url = shared.ai_configuration.url.clone();
                    self.api_key = shared.ai_configuration.api_key.clone().unwrap_or_default();
                    should_close = true;
                }
            });
        });
        should_close
    }
}
