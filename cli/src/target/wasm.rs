use crate::{dev_tools::DevTool, spawner::SpawnOptions, target::Target};

use super::{ProcessCommand, TestSpawnCommand};

pub fn get_build_cmd(prod: bool) -> ProcessCommand {
    let env = if prod { "--release" } else { "--dev" };

    ProcessCommand::new(
        DevTool::WasmPack.cmd(),
        vec![
            String::from("build"),
            String::from(env),
            String::from("--target"),
            String::from("bundler"),
            String::from("--color"),
            String::from("always"),
        ],
    )
}

pub fn get_test_cmds() -> Vec<TestSpawnCommand> {
    let cwd = Target::Wasm.cwd();

    let npm_test_command = if cfg!(windows) { "test_win" } else { "test" };

    vec![
        TestSpawnCommand::new(
            ProcessCommand::new(
                DevTool::WasmPack.cmd(),
                vec![
                    String::from("test"),
                    String::from("--node"),
                    String::from("--color"),
                    String::from("always"),
                ],
            ),
            cwd.clone(),
            None,
        ),
        TestSpawnCommand::new(
            ProcessCommand::new(
                DevTool::Npm.cmd(),
                vec![String::from("run"), String::from(npm_test_command)],
            ),
            cwd.join("spec"),
            Some(SpawnOptions {
                // The output of this command causes a weird behavior on the progress bars.
                suppress_ui: true,
            }),
        ),
    ]
}
