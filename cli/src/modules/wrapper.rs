use super::{Kind, Manager};
use crate::{fstools, spawner::SpawnResult, Target, LOCATION};
use async_trait::async_trait;
use std::{
    fs,
    io::{Error, ErrorKind},
    path::PathBuf,
};

const PATH: &str = "application/apps/rustcore/ts-bindings";

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
        Target::Wrapper
    }
    fn kind(&self) -> Kind {
        Kind::Ts
    }
    fn cwd(&self) -> PathBuf {
        LOCATION.root.clone().join(PATH)
    }
    fn deps(&self) -> Vec<Target> {
        vec![Target::Binding, Target::Shared]
    }
    async fn after(&self) -> Result<Option<SpawnResult>, Error> {
        let src = Target::Binding.get().cwd().join("dist/index.node");
        let dest = self.cwd().join("dist/native");
        if !src.exists() {
            return Err(Error::new(
                ErrorKind::NotFound,
                format!("Not found: {}", src.to_string_lossy()),
            ));
        }
        if !dest.exists() {
            fs::create_dir(&dest)?;
        }
        fstools::cp_file(src, dest.join("index.node")).await?;
        Ok(None)
    }
}
