use super::{Manager, TestCommand};
use crate::{spawner::SpawnOptions, Target};
use async_trait::async_trait;

#[derive(Clone, Debug)]
/// Represents the path `application/apps/rustcore/wasm-bindings`
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

    fn test_cmds(&self, _production: bool) -> Vec<TestCommand> {
        vec![
            TestCommand::new(
                "wasm-pack test --node --color always".into(),
                self.owner().cwd(),
                None,
            ),
            TestCommand::new(
                "npm run test".into(),
                self.owner().cwd().join("spec"),
                Some(SpawnOptions {
                    suppress_msg: true,
                    ..Default::default()
                }),
            ),
        ]
    }
}
