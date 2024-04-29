use std::{io, process::ExitStatus};

use tokio::process::Command;

use crate::{node_cmd, target::Target};

pub async fn run_app() -> io::Result<ExitStatus> {
    let electron_path = Target::App.cwd();

    Command::new(node_cmd::YARN)
        .current_dir(electron_path)
        .args(["run", "electron"])
        .status()
        .await
}
