use super::{Kind, Manager, TestCommand};
use crate::{location::get_root, Target};
use async_trait::async_trait;
use std::path::PathBuf;

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
    fn kind(&self) -> Kind {
        Kind::Rs
    }
    fn cwd(&self) -> PathBuf {
        get_root().join("application").join("apps").join("indexer")
    }
    fn deps(&self) -> Vec<Target> {
        vec![]
    }

    fn test_cmds(&self) -> Vec<TestCommand> {
        vec![TestCommand::new(
            "cargo +stable test --color always".into(),
            self.cwd(),
            None,
        )]
    }
}
