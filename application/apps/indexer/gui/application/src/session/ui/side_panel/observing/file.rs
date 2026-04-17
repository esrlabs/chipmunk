use std::path::Path;

use egui::{Align, Id, Label, Layout, RichText, ScrollArea, TextStyle, Ui, Widget, vec2};
use stypes::{FileFormat, ObserveOrigin};
use tokio::sync::mpsc;
use uuid::Uuid;

use crate::{
    common::{phosphor::icons, ui::buttons},
    host::{
        common::{parsers::ParserNames, ui_utls::truncate_path_to_width},
        ui::{
            UiActions,
            actions::{FileDialogFilter, FileDialogOptions},
        },
    },
    session::{
        command::{AttachSource, SessionCommand},
        types::ObserveOperation,
        ui::shared::{ObserveState, SessionShared},
    },
};

const ATTATCH_FILE_ID: &str = "session_files_observe_tab";

#[derive(Debug)]
pub struct FilesObserveUi {
    id: Id,
    cmd_tx: mpsc::Sender<SessionCommand>,
}

impl FilesObserveUi {
    pub fn new(id_salt: Uuid, cmd_tx: mpsc::Sender<SessionCommand>) -> Self {
        let id = Id::new(format!("side_file_{id_salt}"));
        Self { id, cmd_tx }
    }

    pub fn render_content(
        &mut self,
        ui: &mut Ui,
        shared: &mut SessionShared,
        actions: &mut UiActions,
    ) {
        self.check_attach_dialog(actions);

        super::render_group_title(ui, "Files");

        ui.add_space(super::SPACE_BETWEEN_GROUPS);

        let Some(first_operation) = shared.observe.operations().first() else {
            return;
        };

        // All files will shared the same state because:
        // * Tailing can be applied to one file only.
        // * Multiple files don't support tailing and will be done by default.
        let is_tailing = first_operation.phase().is_running();
        let parser = shared.get_info().parser;
        self.attach_files(ui, first_operation, actions, is_tailing, parser);
        ui.add_space(super::SPACE_BETWEEN_GROUPS);

        self.files_list(ui, &shared.observe, actions, is_tailing);
    }

    fn attach_files(
        &self,
        ui: &mut Ui,
        operation: &ObserveOperation,
        actions: &mut UiActions,
        is_tailing: bool,
        parser: ParserNames,
    ) {
        super::render_attach_source(ui, self.id, "Attach New File", |ui| {
            let file_format = match &operation.origin {
                ObserveOrigin::File(..) => {
                    ui.label(
                        "Single file has been opened. In this case you cannot attach new sources",
                    );
                    return;
                }
                ObserveOrigin::Concat(files) => {
                    if is_tailing {
                        ui.label("Cannot attach new sources while file is tailing");
                        return;
                    }

                    files
                        .first()
                        .map(|f| f.1)
                        .unwrap_or(stypes::FileFormat::Text)
                }
                ObserveOrigin::Stream(..) => return,
            };

            ui.allocate_ui_with_layout(
                vec2(ui.available_width(), 24.0),
                Layout::right_to_left(Align::Center),
                |ui| {
                    if ui
                        .add(buttons::side_panel_primary("Attach Files"))
                        .clicked()
                    {
                        let (title, filters) = match file_format {
                            FileFormat::PcapNG => (
                                "Attach PcapNG Files",
                                vec![FileDialogFilter::new(
                                    "PcapNG",
                                    vec![String::from("pcapng")],
                                )],
                            ),
                            FileFormat::PcapLegacy => (
                                "Attach Pcap Files",
                                vec![FileDialogFilter::new("Pcap", vec![String::from("pcap")])],
                            ),
                            FileFormat::Text => ("Attach Files", Vec::new()),
                            FileFormat::Binary => match parser {
                                ParserNames::Dlt => (
                                    "Attach DLT Files",
                                    vec![FileDialogFilter::new("DLT", vec![String::from("dlt")])],
                                ),
                                ParserNames::SomeIP | ParserNames::Text => {
                                    ("Attach Files", Vec::new())
                                }
                                ParserNames::Plugins => todo!("Plugins not supported yet"),
                            },
                        };

                        actions.file_dialog.pick_files(
                            ATTATCH_FILE_ID,
                            FileDialogOptions::new().title(title).filters(filters),
                        );
                    }
                },
            );
        });
    }

    fn files_list(
        &self,
        ui: &mut Ui,
        state: &ObserveState,
        actions: &mut UiActions,
        is_tailing: bool,
    ) {
        let title = if is_tailing { "Tailing" } else { "Opened" };

        // File sources can't be mixed with other type of sources.
        let files_count = state.sources_count();

        let title = format!("{title} ({files_count})");
        ui.heading(RichText::new(title).size(super::TITLE_SIZE));

        ScrollArea::vertical().show(ui, |ui| {
            let mut idx = 0;
            for operation in state.operations() {
                match &operation.origin {
                    ObserveOrigin::File(uuid, _, path_buf) => {
                        let button = if is_tailing {
                            ButtonAction::Stop {
                                op_id: operation.id,
                            }
                        } else {
                            ButtonAction::NewSession
                        };
                        self.render_file(ui, path_buf, button, idx, uuid, actions);
                        idx += 1;
                    }
                    ObserveOrigin::Concat(items) => {
                        for (uuid, _, path) in items {
                            let button = if is_tailing {
                                ButtonAction::Stop {
                                    op_id: operation.id,
                                }
                            } else {
                                ButtonAction::NewSession
                            };
                            self.render_file(ui, path, button, idx, uuid, actions);
                            idx += 1;
                        }
                    }
                    ObserveOrigin::Stream(..) => {}
                }
            }
        });
    }

    fn render_file(
        &self,
        ui: &mut Ui,
        path: &Path,
        button: ButtonAction,
        idx: usize,
        source_uuid: &str,
        actions: &mut UiActions,
    ) {
        super::render_observe_item(
            ui,
            actions,
            idx,
            icons::regular::FILE,
            |ui| {
                ui.vertical(|ui| {
                    let file_name = path
                        .file_name()
                        .map(|name| name.to_string_lossy())
                        .unwrap_or_default();
                    ui.label(RichText::new(file_name).strong());
                    if let Some(parent) = path.parent() {
                        let parent_label = truncate_path_to_width(
                            ui,
                            parent,
                            ui.available_width(),
                            TextStyle::Body,
                        );
                        let response = Label::new(parent_label.text)
                            .truncate()
                            .show_tooltip_when_elided(false)
                            .ui(ui);
                        if parent_label.truncated {
                            response.on_hover_ui(|ui| {
                                ui.set_max_width(ui.spacing().tooltip_width);
                                ui.label(parent.to_string_lossy());
                            });
                        }
                    }
                });
            },
            |ui, actions| match button {
                ButtonAction::Stop { op_id } => {
                    if super::get_item_button(icons::regular::STOP_CIRCLE)
                        .ui(ui)
                        .on_hover_text("Stop Tailing")
                        .clicked()
                    {
                        let cmd = SessionCommand::CancelOperation { id: op_id };
                        actions.try_send_command(&self.cmd_tx, cmd);
                    }
                }
                ButtonAction::NewSession => {
                    if super::get_item_button(icons::regular::FILE_PLUS)
                        .ui(ui)
                        .on_hover_text("Open file in new session")
                        .clicked()
                    {
                        super::open_in_new_tab(source_uuid, actions, &self.cmd_tx);
                    }
                }
            },
            |ui, actions| {
                if let ButtonAction::Stop { op_id } = button {
                    if ui.button("Stop Tailing").clicked() {
                        let cmd = SessionCommand::CancelOperation { id: op_id };
                        actions.try_send_command(&self.cmd_tx, cmd);
                    }
                    ui.separator();
                }
                if ui.button("Reopen in New Tab").clicked() {
                    super::open_in_new_tab(source_uuid, actions, &self.cmd_tx);
                }
            },
        );
    }

    fn check_attach_dialog(&self, actions: &mut UiActions) {
        let Some(paths) = actions.file_dialog.take_output(ATTATCH_FILE_ID) else {
            return;
        };

        if paths.is_empty() {
            return;
        }

        let cmd = SessionCommand::AttachSource {
            source: AttachSource::Files(paths),
        };
        actions.try_send_command(&self.cmd_tx, cmd);
    }
}

#[derive(Debug)]
enum ButtonAction {
    Stop { op_id: Uuid },
    NewSession,
}
