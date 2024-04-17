use super::{Kind, Manager};
use crate::{location::get_root, Target};
use async_trait::async_trait;
use std::path::PathBuf;

#[derive(Clone, Debug)]
/// Represents the path `application/apps/rustcore/rs-bindings`
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
        get_root()
            .join("application")
            .join("apps")
            .join("rustcore")
            .join("rs-bindings")
    }
    fn deps(&self) -> Vec<Target> {
        vec![Target::Shared]
    }
    fn build_cmd(&self, prod: bool) -> Option<String> {
        let mut path = Target::Wrapper.get().cwd();
        path.push("node_modules");
        path.push(".bin");
        path.push("electron-build-env");

        Some(format!(
            "{} nj-cli build{}",
            path.to_string_lossy(),
            if prod { " --release" } else { "" }
        ))
    }
}
