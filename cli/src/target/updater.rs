use crate::dev_tools::DevTool;

use super::ProcessCommand;

pub fn get_build_cmd() -> ProcessCommand {
    ProcessCommand::new(
        DevTool::Cargo.cmd(),
        vec![
            String::from("+stable"),
            String::from("build"),
            String::from("--color"),
            String::from("always"),
            String::from("--release"),
        ],
    )
}
