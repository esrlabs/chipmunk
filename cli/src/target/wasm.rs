use crate::{spawner::SpawnOptions, target::Target};

use super::TestCommand;

pub fn get_build_cmd(prod: bool) -> String {
    let env = if prod { "--release" } else { "--dev" };

    format!("wasm-pack build {env} --target bundler --color always")
}

pub fn get_test_cmds() -> Vec<TestCommand> {
    let cwd = Target::Wasm.cwd();
    vec![
        TestCommand::new(
            "wasm-pack test --node --color always".into(),
            cwd.clone(),
            None,
        ),
        TestCommand::new(
            "npm run test".into(),
            cwd.join("spec"),
            Some(SpawnOptions {
                suppress_msg: true,
                ..Default::default()
            }),
        ),
    ]
}
