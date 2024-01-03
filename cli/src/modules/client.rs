use super::{Kind, Manager};
use crate::{Target, LOCATION};
use async_trait::async_trait;
use std::path::PathBuf;

const PATH: &str = "application/client";

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
        Target::Client
    }
    fn kind(&self) -> Kind {
        Kind::Ts
    }
    fn cwd(&self) -> PathBuf {
        LOCATION.root.clone().join(PATH)
    }
    fn deps(&self) -> Vec<Target> {
        vec![Target::Shared, Target::Wasm]
    }
}
