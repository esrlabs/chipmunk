use super::{Kind, Manager};
use crate::{fstools, spawner::SpawnResult, Target, LOCATION};
use async_trait::async_trait;
use std::{
    fs,
    io::{Error, ErrorKind},
    path::PathBuf,
};

const PATH: &str = "application/holder";

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
        Target::App
    }
    fn kind(&self) -> Kind {
        Kind::Ts
    }
    fn cwd(&self) -> PathBuf {
        LOCATION.root.clone().join(PATH)
    }
    fn deps(&self) -> Vec<Target> {
        vec![Target::Shared, Target::Wrapper, Target::Client]
    }
    fn install_cmd(&self, _prod: bool) -> Option<String> {
        // For app we don't need --production
        Some(String::from("yarn install"))
    }
    async fn after(&self) -> Result<Option<SpawnResult>, Error> {
        let src = Target::Client.get().cwd().join("dist/client");
        let dest = self.cwd().join("dist");
        if !src.exists() {
            return Err(Error::new(
                ErrorKind::NotFound,
                format!("Not found: {}", src.to_string_lossy()),
            ));
        }
        if !dest.exists() {
            fs::create_dir(&dest)?;
        }
        let prev = dest.join("client");
        if prev.exists() {
            fstools::rm_folder(prev).await?;
        }
        fstools::cp_folder(src, dest).await?;
        Ok(None)
    }
}
