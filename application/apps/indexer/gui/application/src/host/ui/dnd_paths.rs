//! Host-level OS path drag-and-drop handling for files and directories.

use std::fmt::Write as _;

use egui::{Align2, Id, LayerId, Order, TextStyle, Ui};
use stypes::FileFormat;
use tokio::sync::mpsc::Sender;

use crate::host::{command::HostCommand, ui::UiActions};

/// Previews hovered OS paths and opens dropped files or text-file directories through the normal host flow.
pub fn handle_path_drops(ui: &mut Ui, actions: &mut UiActions, cmd_tx: &Sender<HostCommand>) {
    preview_files_being_dropped(ui);
    handle_dropping_files(ui, actions, cmd_tx);
}

/// Consumes dropped paths and forwards files and directories to matching host open commands.
fn handle_dropping_files(ui: &mut Ui, actions: &mut UiActions, cmd_tx: &Sender<HostCommand>) {
    if ui.input(|input| input.raw.dropped_files.is_empty()) {
        return;
    }

    let mut files = Vec::new();
    let mut dirs = Vec::new();

    for path in ui
        .input_mut(|input| std::mem::take(&mut input.raw.dropped_files))
        .into_iter()
        .filter_map(|file| file.path)
    {
        if path.is_dir() {
            dirs.push(path);
        } else {
            files.push(path);
        }
    }

    if !files.is_empty() {
        actions.try_send_command(cmd_tx, HostCommand::OpenFiles(files));
    }

    for dir_path in dirs {
        // Check for text files when directories are dropped as reasonable default.
        actions.try_send_command(
            cmd_tx,
            HostCommand::OpenFromDirectory {
                dir_path,
                target_format: FileFormat::Text,
            },
        );
    }
}

/// Paints a full-window preview while OS paths hover over the app.
fn preview_files_being_dropped(ui: &mut Ui) {
    if ui.input(|input| input.raw.hovered_files.is_empty()) {
        return;
    }

    let mut text = "Drop to open:".to_owned();
    ui.input(|input| {
        for file in &input.raw.hovered_files {
            if let Some(path) = &file.path {
                write!(text, "\n{}", path.display()).ok();
            } else if !file.mime.is_empty() {
                write!(text, "\n{}", file.mime).ok();
            }
        }
    });

    let painter = ui.layer_painter(LayerId::new(Order::Foreground, Id::new("file_drop_target")));
    let screen_rect = ui.content_rect();
    let style = ui.global_style();

    painter.rect_filled(
        screen_rect,
        0.0,
        style.visuals.extreme_bg_color.gamma_multiply_u8(192),
    );
    painter.text(
        screen_rect.center(),
        Align2::CENTER_CENTER,
        text,
        TextStyle::Body.resolve(&style),
        style.visuals.strong_text_color(),
    );
}
