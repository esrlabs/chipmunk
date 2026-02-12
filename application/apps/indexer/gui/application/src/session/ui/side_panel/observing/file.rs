use std::path::Path;

use egui::{Align, Button, Label, Layout, RichText, ScrollArea, Ui, Widget};
use stypes::{FileFormat, ObserveOrigin};
use tokio::sync::mpsc;
use uuid::Uuid;

use crate::{
    common::phosphor::icons,
    host::{
        command::HostCommand,
        common::parsers::ParserNames,
        ui::{UiActions, actions::FileDialogFilter},
    },
    session::{
        command::{AttachSource, SessionCommand},
        types::{ObserveOperation, OperationPhase},
        ui::shared::{ObserveState, SessionShared},
    },
};

const ATTATCH_FILE_ID: &str = "session_files_observe_tab";

pub fn render_content(
    ui: &mut Ui,
    shared: &mut SessionShared,
    actions: &mut UiActions,
    cmd_rx: &mpsc::Sender<SessionCommand>,
    host_cmd_tx: &mpsc::Sender<HostCommand>,
) {
    check_attach_dialog(actions, cmd_rx);

    super::render_group_title(ui, "Files");

    let space = 5.;
    ui.add_space(space);

    let Some(first_operation) = shared.observe.operations().first() else {
        return;
    };

    // All files will shared the same state because:
    // * Tailing can be applied to one file only.
    // * Multiple files don't support tailing and will be done by default.
    let is_tailing = match first_operation.phase() {
        OperationPhase::Initializing | OperationPhase::Processing => true,
        OperationPhase::Done => false,
    };
    let parser = shared.get_info().parser;
    attach_files(ui, first_operation, actions, is_tailing, parser);
    ui.add_space(space);

    files_list(
        ui,
        &shared.observe,
        actions,
        cmd_rx,
        host_cmd_tx,
        is_tailing,
    );
}

fn attach_files(
    ui: &mut Ui,
    operation: &ObserveOperation,
    actions: &mut UiActions,
    is_tailing: bool,
    parser: ParserNames,
) {
    let id = ui.make_persistent_id(format!("attach_{}", operation.id));
    super::render_attach_source(ui, id, "Attach New File", |ui| {
        let file_format = match &operation.origin {
            ObserveOrigin::File(..) => {
                ui.label("Single file has been opened. In this case you cannot attach new sources");
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

        ui.with_layout(Layout::right_to_left(Align::TOP), |ui| {
            if ui.button("Attach Files").clicked() {
                let mut filters = Vec::new();
                match file_format {
                    FileFormat::PcapNG => {
                        filters.push(FileDialogFilter::new(
                            "PcapNG",
                            vec![String::from("pcapng")],
                        ));
                    }
                    FileFormat::PcapLegacy => {
                        filters.push(FileDialogFilter::new("Pcap", vec![String::from("pcap")]));
                    }
                    FileFormat::Text => {}
                    FileFormat::Binary => match parser {
                        ParserNames::Dlt => {
                            filters.push(FileDialogFilter::new("DLT", vec![String::from("dlt")]));
                        }
                        ParserNames::SomeIP | ParserNames::Text => {}
                        ParserNames::Plugins => todo!("Plugins not supported yet"),
                    },
                };
                actions.file_dialog.pick_files(ATTATCH_FILE_ID, &filters);
            }
        });
    });
}

fn files_list(
    ui: &mut Ui,
    state: &ObserveState,
    actions: &mut UiActions,
    cmd_rx: &mpsc::Sender<SessionCommand>,
    host_cmd_tx: &mpsc::Sender<HostCommand>,
    is_tailing: bool,
) {
    let title = if is_tailing { "Tailing" } else { "Opened" };

    // File sources can't be mixed with other type of sources.
    let files_count = state.sources_count();

    let title = format!("{title} ({files_count})");
    ui.heading(RichText::new(title).size(14.0));

    ScrollArea::vertical().show(ui, |ui| {
        let mut idx = 0;
        for operation in state.operations() {
            match &operation.origin {
                ObserveOrigin::File(_, _, path_buf) => {
                    let button = if is_tailing {
                        ButtonAction::Stop {
                            op_id: operation.id,
                        }
                    } else {
                        ButtonAction::NewSession
                    };
                    render_file(ui, path_buf, button, idx, actions, cmd_rx, host_cmd_tx);
                    idx += 1;
                }
                ObserveOrigin::Concat(items) => {
                    for (_, _, path) in items {
                        let button = if is_tailing {
                            ButtonAction::Stop {
                                op_id: operation.id,
                            }
                        } else {
                            ButtonAction::NewSession
                        };
                        render_file(ui, path, button, idx, actions, cmd_rx, host_cmd_tx);
                        idx += 1;
                    }
                }
                ObserveOrigin::Stream(..) => {}
            }
        }
    });
}

#[derive(Debug)]
enum ButtonAction {
    Stop { op_id: Uuid },
    NewSession,
}

fn render_file(
    ui: &mut Ui,
    path: &Path,
    button: ButtonAction,
    idx: usize,
    actions: &mut UiActions,
    cmd_rx: &mpsc::Sender<SessionCommand>,
    host_cmd_tx: &mpsc::Sender<HostCommand>,
) {
    let color = ObserveState::source_color(idx);

    let title = path
        .extension()
        .map(|ext| format!(".{}", ext.to_string_lossy()))
        .unwrap_or_default();

    super::render_observe_item(
        ui,
        color,
        &title,
        |ui| {
            ui.vertical(|ui| {
                let file_name = path
                    .file_name()
                    .map(|name| name.to_string_lossy().to_string())
                    .unwrap_or_default();
                ui.label(RichText::new(file_name).strong());
                if let Some(parent) = path.parent() {
                    Label::new(parent.to_string_lossy()).truncate().ui(ui);
                }
            });
        },
        |ui| {
            ui.horizontal_centered(|ui| {
                let get_button = |content| {
                    Button::new(RichText::new(content).size(18.0))
                        .frame(false)
                        .frame_when_inactive(false)
                };
                match button {
                    ButtonAction::Stop { op_id } => {
                        if get_button(icons::regular::STOP_CIRCLE)
                            .ui(ui)
                            .on_hover_text("Stop Tailing")
                            .clicked()
                        {
                            let cmd = SessionCommand::CancelOperation { id: op_id };
                            actions.try_send_command(cmd_rx, cmd);
                        }
                    }
                    ButtonAction::NewSession => {
                        if get_button(icons::regular::FILE_PLUS)
                            .ui(ui)
                            .on_hover_text("Open file in new session")
                            .clicked()
                        {
                            let cmd = HostCommand::OpenFiles(vec![path.into()]);
                            actions.try_send_command(host_cmd_tx, cmd);
                        }
                    }
                }
            });
        },
    );
}

fn check_attach_dialog(actions: &mut UiActions, cmd_rx: &mpsc::Sender<SessionCommand>) {
    let Some(paths) = actions.file_dialog.take_output(ATTATCH_FILE_ID) else {
        return;
    };

    if paths.is_empty() {
        return;
    }

    let cmd = SessionCommand::AttachSource {
        source: Box::new(AttachSource::Files(paths)),
    };
    actions.try_send_command(cmd_rx, cmd);
}
