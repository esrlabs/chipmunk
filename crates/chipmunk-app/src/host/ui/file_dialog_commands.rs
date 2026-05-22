//! File dialog commands shared by menus and shortcuts.

use stypes::FileFormat;
use tokio::sync::mpsc::Sender;

use crate::host::{
    command::HostCommand,
    ui::actions::{FileDialogOptions, UiActions},
};

const OPEN_FILES_ID: &str = "menu_open_files";
const OPEN_FILES_WITH_PLUGIN_ID: &str = "menu_open_files_with_plugin";
const TEXT_FILES_FROM_DIR: &str = "menu_text_files";
const BINARY_DLT_FILES_FROM_DIR: &str = "menu_binary_dlt_files";
const PCAPNG_FILES_FROM_DIR: &str = "menu_pacpng_files";
const PCAP_FILES_FROM_DIR: &str = "menu_pcap_files";

/// Opens the generic multi-file picker.
pub fn open_files_dialog(actions: &mut UiActions) {
    actions
        .file_dialog
        .pick_files(OPEN_FILES_ID, FileDialogOptions::new().title("Open Files"));
}

/// Opens the multi-file picker for plugin-backed sessions.
pub fn open_files_with_plugin_dialog(actions: &mut UiActions) {
    actions.file_dialog.pick_files(
        OPEN_FILES_WITH_PLUGIN_ID,
        FileDialogOptions::new().title("Open Files with Plugin"),
    );
}

/// Opens a folder picker for files with the requested format.
pub fn open_folder_dialog(actions: &mut UiActions, format: FileFormat) {
    actions.file_dialog.pick_folder(
        id_from_file_format(format),
        FileDialogOptions::new().title(folder_dialog_title(format)),
    );
}

/// Sends host commands for completed file dialog selections.
pub fn handle_dialog_output(actions: &mut UiActions, cmd_tx: &Sender<HostCommand>) {
    if let Some((id, paths)) = actions.file_dialog.take_output_many(all_file_dialog_ids())
        && !paths.is_empty()
    {
        if id == OPEN_FILES_ID {
            actions.try_send_command(cmd_tx, HostCommand::OpenFiles(paths));
            return;
        }

        if id == OPEN_FILES_WITH_PLUGIN_ID {
            actions.try_send_command(cmd_tx, HostCommand::OpenFilesWithPlugin(paths));
            return;
        }

        if let Some(target_format) = file_format_from_id(id) {
            let dir_path = paths
                .into_iter()
                .next()
                .expect("paths length is checked in parent if");
            let cmd = HostCommand::OpenFromDirectory {
                dir_path,
                target_format,
            };
            actions.try_send_command(cmd_tx, cmd);
            return;
        }

        panic!("File dialog: Not implemented dialog id {id}");
    }
}

const fn all_file_dialog_ids() -> &'static [&'static str] {
    // Reminder on adding new file formats.
    match FileFormat::Text {
        FileFormat::PcapNG => {}
        FileFormat::PcapLegacy => {}
        FileFormat::Text => {}
        FileFormat::Binary => {}
    }

    &[
        OPEN_FILES_ID,
        OPEN_FILES_WITH_PLUGIN_ID,
        TEXT_FILES_FROM_DIR,
        BINARY_DLT_FILES_FROM_DIR,
        PCAPNG_FILES_FROM_DIR,
        PCAP_FILES_FROM_DIR,
    ]
}

const fn id_from_file_format(format: FileFormat) -> &'static str {
    match format {
        FileFormat::PcapNG => PCAPNG_FILES_FROM_DIR,
        FileFormat::PcapLegacy => PCAP_FILES_FROM_DIR,
        FileFormat::Text => TEXT_FILES_FROM_DIR,
        FileFormat::Binary => BINARY_DLT_FILES_FROM_DIR,
    }
}

const fn folder_dialog_title(format: FileFormat) -> &'static str {
    match format {
        FileFormat::PcapNG => "Select Folder with PcapNG Files",
        FileFormat::PcapLegacy => "Select Folder with Pcap Files",
        FileFormat::Text => "Select Folder with Text Files",
        // Binary is used here for DLT files to preserve existing behavior.
        FileFormat::Binary => "Select Folder with DLT Files",
    }
}

fn file_format_from_id(id: &str) -> Option<FileFormat> {
    // Reminder on adding new file formats.
    match FileFormat::Text {
        FileFormat::PcapNG => {}
        FileFormat::PcapLegacy => {}
        FileFormat::Text => {}
        FileFormat::Binary => {}
    }

    let format = match id {
        TEXT_FILES_FROM_DIR => FileFormat::Text,
        BINARY_DLT_FILES_FROM_DIR => FileFormat::Binary,
        PCAPNG_FILES_FROM_DIR => FileFormat::PcapNG,
        PCAP_FILES_FROM_DIR => FileFormat::PcapLegacy,
        _ => return None,
    };

    Some(format)
}
