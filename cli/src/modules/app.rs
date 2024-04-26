use super::Manager;
use crate::{fstools, spawner::SpawnResult, target, Target};
use anyhow::{bail, Context, Error};
use async_trait::async_trait;
use std::fs;

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

    fn install_cmd(&self, _prod: bool) -> Option<String> {
        // For app we don't need --production
        Some(String::from("yarn install"))
    }
    async fn after(&self, prod: bool) -> Result<Option<SpawnResult>, Error> {
        let mut report_logs = Vec::new();
        let src = target::client::get_dist_path(prod);
        let dest = self.owner().cwd().join("dist");
        if !src.exists() {
            bail!("Not found: {}", src.display());
        }
        if !dest.exists() {
            let msg = format!("creating directory: {}", dest.display());
            report_logs.push(msg);

            fs::create_dir(&dest)
                .with_context(|| format!("Error while creating directory: {}", dest.display()))?;
        }
        let prev = dest.join("client");
        if prev.exists() {
            let msg = format!("removing directory: {}", prev.display());
            report_logs.push(msg);

            fstools::rm_folder(&prev).await?;
        }

        fstools::cp_folder(src.clone(), dest.clone(), &mut report_logs).await?;

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

        std::fs::rename(&rename_from, &rename_to)
            .with_context(|| format!("Error while renaming {}", rename_from.display()))?;

        Ok(Some(SpawnResult::create_for_fs(
            "Copy App Build Artifacts".into(),
            report_logs,
        )))
    }
}
