use super::{Kind, Manager};
use crate::{location::get_root, Target};
use async_trait::async_trait;
use std::path::PathBuf;

#[derive(Clone, Debug)]
/// Represents the path `application/platform`
pub struct Module {}

impl Module {
    pub fn new() -> Self {
        Self {}
    }
}

#[async_trait]
impl Manager for Module {
    fn owner(&self) -> Target {
        Target::Shared
    }
    fn kind(&self) -> Kind {
        Kind::Ts
    }
    fn cwd(&self) -> PathBuf {
        get_root().join("application").join("platform")
    }
    fn deps(&self) -> Vec<Target> {
        vec![]
    }
}
