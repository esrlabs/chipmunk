//! Module to manage running Chipmunk after being built.

use std::{io, process::ExitStatus};

use tokio::process::Command;

use crate::{dev_tools::DevTool, target::Target};

/// Runs Chipmunk application from its electron path.
pub async fn run_chipmunk() -> io::Result<ExitStatus> {
    let electron_path = Target::App.cwd();

    let yarn_path = DevTool::Yarn.path();

    let electron_arg = if cfg!(windows) {
        "electron-win"
    } else {
        "electron"
    };

    Command::new(yarn_path)
        .current_dir(electron_path)
        .args(["run", electron_arg])
        .kill_on_drop(true)
        .status()
        .await
}
