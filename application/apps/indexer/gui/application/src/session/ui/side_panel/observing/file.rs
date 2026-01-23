use std::path::Path;

use egui::{Button, Label, RichText, Ui, Widget};
use stypes::ObserveOrigin;
use tokio::sync::mpsc;
use uuid::Uuid;

use crate::{
    common::phosphor::icons,
    host::{command::HostCommand, ui::UiActions},
    session::{
        command::SessionCommand,
        types::{ObserveOperation, OperationPhase},
        ui::shared::ObserveState,
    },
};

pub fn render_content(
    ui: &mut Ui,
    operation: &ObserveOperation,
    actions: &mut UiActions,
    cmd_rx: &mpsc::Sender<SessionCommand>,
    host_cmd_tx: &mpsc::Sender<HostCommand>,
) {
    super::render_group_title(ui, "Files");

    let space = 5.;
    ui.add_space(space);

    attach_files(ui);
    ui.add_space(space);

    files_list(ui, operation, actions, cmd_rx, host_cmd_tx);
}

fn attach_files(ui: &mut Ui) {
    ui.horizontal_wrapped(|ui| {
        ui.label("Attach New File TODO");
    });
}

fn files_list(
    ui: &mut Ui,
    operation: &ObserveOperation,
    actions: &mut UiActions,
    cmd_rx: &mpsc::Sender<SessionCommand>,
    host_cmd_tx: &mpsc::Sender<HostCommand>,
) {
    // All files will shared the same state because:
    // * Tailing can be applied to one file only.
    // * Multiple files don't support tailing and will be done by default.
    let is_tailing = match operation.phase() {
        OperationPhase::Initializing | OperationPhase::Processing => true,
        OperationPhase::Done => false,
    };
    let title = if is_tailing { "Tailing" } else { "Opened" };

    // File sources can't be mixed with other type of sources.
    let files_count = match &operation.origin {
        ObserveOrigin::File(..) => 1,
        ObserveOrigin::Concat(items) => items.len(),
        ObserveOrigin::Stream(..) => return,
    };

    let title = format!("{title} ({files_count})");
    ui.heading(RichText::new(title).size(14.0));

    match &operation.origin {
        ObserveOrigin::File(_, _, path_buf) => {
            let button = if is_tailing {
                ButtonAction::Stop {
                    op_id: operation.id,
                }
            } else {
                ButtonAction::NewSession
            };
            render_file(ui, path_buf, button, 0, actions, cmd_rx, host_cmd_tx)
        }
        ObserveOrigin::Concat(items) => {
            for (idx, (_, _, path)) in items.iter().enumerate() {
                let button = if is_tailing {
                    ButtonAction::Stop {
                        op_id: operation.id,
                    }
                } else {
                    ButtonAction::NewSession
                };
                render_file(ui, path, button, idx, actions, cmd_rx, host_cmd_tx);
            }
        }
        ObserveOrigin::Stream(..) => {}
    }
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
