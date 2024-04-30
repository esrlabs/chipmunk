use crate::{dev_tools::DevTool, spawner::SpawnOptions, target::Target};

use super::TestCommand;

pub async fn get_build_cmd(prod: bool) -> String {
    let wasm_pack_path = DevTool::WasmPack.path().await;
    let env = if prod { "--release" } else { "--dev" };

    format!(
        "{} build {env} --target bundler --color always",
        wasm_pack_path.to_string_lossy()
    )
}

pub async fn get_test_cmds() -> Vec<TestCommand> {
    let cwd = Target::Wasm.cwd();

    let npm_path = DevTool::Npm.path().await;
    let wasm_pack_path = DevTool::WasmPack.path().await;

    vec![
        TestCommand::new(
            format!(
                "{} test --node --color always",
                wasm_pack_path.to_string_lossy()
            ),
            cwd.clone(),
            None,
        ),
        TestCommand::new(
            format!("{} run test", npm_path.to_string_lossy()),
            cwd.join("spec"),
            Some(SpawnOptions {
                suppress_msg: true,
                ..Default::default()
            }),
        ),
    ]
}
