use crate::{dev_tools::DevTool, spawner::SpawnOptions, target::Target};

use super::{ProcessCommand, TestSpawnCommand};

pub async fn get_build_cmd(prod: bool) -> ProcessCommand {
    let wasm_pack_path = DevTool::WasmPack.path().await;
    let env = if prod { "--release" } else { "--dev" };

    ProcessCommand::new(
        wasm_pack_path.to_string_lossy().to_string(),
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

pub async fn get_test_cmds() -> Vec<TestSpawnCommand> {
    let cwd = Target::Wasm.cwd();

    let npm_path = DevTool::Npm.path().await;
    let wasm_pack_path = DevTool::WasmPack.path().await;

    vec![
        TestSpawnCommand::new(
            ProcessCommand::new(
                wasm_pack_path.to_string_lossy().to_string(),
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
                npm_path.to_string_lossy().to_string(),
                vec![String::from("run"), String::from("test")],
            ),
            cwd.join("spec"),
            Some(SpawnOptions {
                suppress_msg: true,
                ..Default::default()
            }),
        ),
    ]
}
