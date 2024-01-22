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
    async fn after(&self, prod: bool) -> Result<Option<SpawnResult>, Error> {
        let src = Target::Client.get().dist_path(prod).ok_or(Error::new(
            ErrorKind::NotFound,
            "Fail to get client artifacts",
        ))?;
        let dest = self.cwd().join("dist");
        if !src.exists() {
            return Err(Error::new(
                ErrorKind::NotFound,
                format!("Not found: {}", src.display()),
            ));
        }
        if !dest.exists() {
            fs::create_dir(&dest)?;
        }
        let prev = dest.join("client");
        if prev.exists() {
            fstools::rm_folder(prev).await?;
        }
        fstools::cp_folder(src.clone(), dest.clone()).await?;
        std::fs::rename(
            dest.join(src.file_name().ok_or(Error::new(
                ErrorKind::NotFound,
                "Fail to parse client artifacts path",
            ))?),
            dest.join("client"),
        )?;
        Ok(None)
    }
}
