use super::{Kind, Manager};
use crate::{Target, LOCATION};
use async_trait::async_trait;
use std::path::PathBuf;

const PATH: &str = "application/apps/indexer";

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
        Target::Core
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
}
