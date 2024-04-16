use super::{Kind, Manager};
use crate::{location::get_root, Target};
use async_trait::async_trait;
use std::path::PathBuf;

#[derive(Clone, Debug)]
/// Represents the path `application/client`
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
        get_root().join("application").join("client")
    }
    fn deps(&self) -> Vec<Target> {
        vec![Target::Shared, Target::Wasm]
    }
    fn dist_path(&self, prod: bool) -> Option<PathBuf> {
        Some(
            self.cwd()
                .join("dist")
                .join(if prod { "release" } else { "debug" }),
        )
    }
}
