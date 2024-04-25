use super::{Kind, Manager};
use crate::{fstools, location::get_root, spawner::SpawnResult, Target};
use anyhow::{Context, Error};
use async_trait::async_trait;
use std::{fs, path::PathBuf};

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
    async fn after(&self, _prod: bool) -> Result<Option<SpawnResult>, Error> {
        let mut report_logs = Vec::new();

        report_logs.push(String::from("Start Job: Copying Platform to Bindings..."));

        let platform_dest = Target::Wrapper
            .get()
            .cwd()
            .join("node_modules")
            .join("platform");

        let msg = format!("Removing directory: '{}'", platform_dest.display());
        report_logs.push(msg);

        fstools::rm_folder(&platform_dest).await?;

        tokio::fs::create_dir_all(&platform_dest)
            .await
            .with_context(|| {
                format!("Error while creating directory {}", platform_dest.display())
            })?;

        let source = self.cwd();

        // This part to get all the needed files and folders to copy
        let entries_to_copy: Vec<_> = fs::read_dir(&source)
            .with_context(|| {
                format!(
                    "Error while reading directory content: {}",
                    source.display()
                )
            })?
            .filter_map(|entry_res| entry_res.ok().map(|entry| entry.path()))
            .filter(|path| {
                path.file_name().is_some_and(|file_name| {
                    !file_name.to_string_lossy().starts_with("node_modules")
                })
            })
            .collect();

        fstools::cp_many(
            entries_to_copy,
            platform_dest,
            source.display(),
            &mut report_logs,
        )
        .await?;

        Ok(Some(SpawnResult::create_for_fs(
            "Copying Platform to Bindings".into(),
            report_logs,
        )))
    }
}
