use super::{Manager, TestCommand};
use crate::Target;
use async_trait::async_trait;

#[derive(Clone, Debug)]
/// Represents the path `application/apps/indexer`
pub struct Module {}

impl Module {
    pub fn new() -> Self {
        Self {}
    }
}

#[async_trait]
impl Manager for Module {
    fn owner(&self) -> Target {
        Target::Core
    }
    fn deps(&self) -> Vec<Target> {
        vec![]
    }

    fn test_cmds(&self, production: bool) -> Vec<TestCommand> {
        let cmd = format!(
            "cargo +stable test{} --color always",
            if production { " -r" } else { "" }
        );

        vec![TestCommand::new(cmd, self.owner().cwd(), None)]
    }
}
