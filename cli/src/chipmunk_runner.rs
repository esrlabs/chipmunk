//! Module to manage running Chipmunk after being built.

use std::{io, process::ExitStatus};

use crate::{dev_tools::DevTool, shell::shell_tokio_command, target::Target};

/// Runs Chipmunk application from its electron path.
pub async fn run_chipmunk() -> io::Result<ExitStatus> {
    let electron_path = Target::App.cwd();

    let yarn_path = DevTool::Yarn.path();

    let electron_arg = if cfg!(windows) {
        "electron-win"
    } else {
        "electron"
    };

    let yarn_path = yarn_path.to_string_lossy();

    shell_tokio_command()
        .arg([&yarn_path, "run", electron_arg].join(" "))
        .current_dir(electron_path)
        .kill_on_drop(true)
        .status()
        .await
}
