use std::{io, process::ExitStatus};

use tokio::process::Command;

use crate::target::Target;

pub async fn run_app() -> io::Result<ExitStatus> {
    let electron_path = Target::App.get().cwd();

    Command::new("yarn")
        .current_dir(electron_path)
        .args(["run", "electron"])
        .status()
        .await
}
