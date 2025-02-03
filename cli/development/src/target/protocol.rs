use crate::dev_tools::DevTool;

use super::ProcessCommand;

pub fn get_build_cmd(prod: bool) -> ProcessCommand {
    let env = if prod { "--release" } else { "--dev" };

    ProcessCommand::new(
        DevTool::WasmPack.cmd(),
        vec![
            String::from("build"),
            String::from(env),
            String::from("--target"),
            String::from("nodejs"),
            String::from("--color"),
            String::from("always"),
        ],
    )
}
