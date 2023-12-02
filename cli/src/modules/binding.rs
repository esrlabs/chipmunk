use super::{Kind, Manager};
use crate::{Target, LOCATION};
use async_trait::async_trait;
use std::path::PathBuf;

const PATH: &str = "application/apps/rustcore/rs-bindings";

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
        Target::Binding
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
        let path = Target::Wrapper
            .get()
            .cwd()
            .join("node_modules/.bin/electron-build-env");
        Some(format!(
            "{} nj-cli build{}",
            path.to_string_lossy(),
            if prod { " --release" } else { "" }
        ))
    }
}
