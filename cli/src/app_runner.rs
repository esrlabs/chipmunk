use std::{io, process::ExitStatus};

use tokio::process::Command;

use crate::{dev_tools::DevTool, target::Target};

pub async fn run_app() -> io::Result<ExitStatus> {
    let electron_path = Target::App.cwd();

    let yarn_path = DevTool::Yarn.path().await;

    Command::new(yarn_path)
        .current_dir(electron_path)
        .args(["run", "electron"])
        .status()
        .await
}
