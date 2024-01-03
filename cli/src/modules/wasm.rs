use super::{Kind, Manager, TestCommand};
use crate::{spawner::SpawnOptions, Target, LOCATION};
use async_trait::async_trait;
use std::path::PathBuf;

const PATH: &str = "application/apps/rustcore/wasm-bindings";

#[derive(Clone, Debug)]
pub struct Module {}

impl Module {
    pub fn new() -> Self {
        Self {}
    }
}

#[async_trait]
impl Manager for Module {
    fn owner(&self) -> Target {
        Target::Wasm
    }
    fn kind(&self) -> Kind {
        Kind::Rs
    }
    fn cwd(&self) -> PathBuf {
        LOCATION.root.clone().join(PATH)
    }

    fn deps(&self) -> Vec<Target> {
        vec![]
    }

    fn build_cmd(&self, prod: bool) -> Option<String> {
        let env = if prod { "--release" } else { "--dev" };

        Some(format!(
            "wasm-pack build {env} --target bundler --color always"
        ))
    }

    fn test_cmds(&self) -> Vec<TestCommand> {
        vec![
            TestCommand::new(
                "wasm-pack test --node --color always".into(),
                self.cwd(),
                None,
            ),
            TestCommand::new(
                "npm run test".into(),
                self.cwd().join("spec"),
                Some(SpawnOptions { suppress_msg: true }),
            ),
        ]
    }
}
