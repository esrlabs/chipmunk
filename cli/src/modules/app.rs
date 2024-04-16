use super::{Kind, Manager};
use crate::{fstools, location::get_root, spawner::SpawnResult, Target};
use anyhow::{bail, Context, Error};
use async_trait::async_trait;
use std::{fs, path::PathBuf};

#[derive(Clone, Debug)]
/// Represents the path `application/holder`
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
        get_root().join("application").join("holder")
    }
    fn deps(&self) -> Vec<Target> {
        vec![Target::Shared, Target::Wrapper, Target::Client]
    }
    fn install_cmd(&self, _prod: bool) -> Option<String> {
        // For app we don't need --production
        Some(String::from("yarn install"))
    }
    async fn after(&self, prod: bool) -> Result<Option<SpawnResult>, Error> {
        let mut report_logs = Vec::new();
        let src = Target::Client
            .get()
            .dist_path(prod)
            .context("Fail to get client artifacts")?;
        let dest = self.cwd().join("dist");
        if !src.exists() {
            bail!("Not found: {}", src.display());
        }
        if !dest.exists() {
            let msg = format!("creating directory: {}", dest.display());
            report_logs.push(msg);

            fs::create_dir(&dest)?;
        }
        let prev = dest.join("client");
        if prev.exists() {
            let msg = format!("removig directory: {}", prev.display());
            report_logs.push(msg);

            fstools::rm_folder(prev).await?;
        }

        let msg = format!(
            "copying directory: '{}' to '{}'",
            src.display(),
            dest.display()
        );
        report_logs.push(msg);

        fstools::cp_folder(src.clone(), dest.clone()).await?;

        let rename_from = dest.join(
            src.file_name()
                .context("Fail to parse client artifacts path")?,
        );
        let rename_to = dest.join("client");

        let msg = format!(
            "renaming '{}' to '{}'",
            rename_from.display(),
            rename_to.display()
        );
        report_logs.push(msg);

        std::fs::rename(rename_from, rename_to)?;

        Ok(Some(SpawnResult::create_for_fs(
            "Copy App Build Artifacts".into(),
            report_logs,
        )))
    }
}
