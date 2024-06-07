use crate::dev_tools::DevTool;

use super::ProcessCommand;

pub async fn get_build_cmd() -> ProcessCommand {
    let cargo_path = DevTool::Cargo.path().await;

    ProcessCommand::new(
        cargo_path.to_string_lossy().to_string(),
        vec![
            String::from("+stable"),
            String::from("build"),
            String::from("--color"),
            String::from("always"),
            String::from("--release"),
        ],
    )
}
