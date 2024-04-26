use super::Manager;
use crate::{fstools, spawner::SpawnResult, Target};
use anyhow::{Context, Error};
use async_trait::async_trait;
use std::fs;

#[derive(Clone, Debug)]
/// Represents the path `application/apps/rustcore/ts-bindings`
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
    async fn after(&self, _prod: bool) -> Result<Option<SpawnResult>, Error> {
        let mut report_logs = Vec::new();

        // *** Copying TS Bindings ***
        report_logs.push(String::from("Copying ts-bindings to electron..."));
        let rustcore_dest = Target::App.cwd().join("node_modules").join("rustcore");

        fstools::rm_folder(&rustcore_dest).await?;

        let msg = format!("Removing directory: '{}'", rustcore_dest.display());
        report_logs.push(msg);

        tokio::fs::create_dir_all(&rustcore_dest)
            .await
            .with_context(|| {
                format!("Error while creating directory {}", rustcore_dest.display())
            })?;

        // This part to get all the needed files and folders to copy
        let ts_source = self.owner().cwd();
        let ts_entries_to_copy: Vec<_> = fs::read_dir(&ts_source)
            .with_context(|| {
                format!(
                    "Error while reading directory content: {}",
                    ts_source.display()
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
            ts_entries_to_copy,
            rustcore_dest.clone(),
            ts_source.display(),
            &mut report_logs,
        )
        .await?;

        // *** Remove native folder ***
        let native_dir_path = rustcore_dest.join("native");
        report_logs.push(format!(
            "Removing the directory '{}'",
            native_dir_path.display()
        ));

        fstools::rm_folder(&native_dir_path).await?;

        // *** Copy Platform rustcore to electron ***
        report_logs.push(String::from("Copying platform rustcore in to electron..."));
        let platform_dest = rustcore_dest.join("node_modules").join("platform");

        fstools::rm_folder(&platform_dest).await?;
        tokio::fs::create_dir_all(&platform_dest)
            .await
            .with_context(|| {
                format!(
                    "Error while creating directory: {}",
                    platform_dest.display()
                )
            })?;

        let platform_src = Target::Shared.cwd();

        let platform_entries_to_copy: Vec<_> = fs::read_dir(&platform_src)
            .with_context(|| {
                format!(
                    "Error while reading directory content: {}",
                    platform_src.display()
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
            platform_entries_to_copy.clone(),
            platform_dest,
            platform_src.display(),
            &mut report_logs,
        )
        .await?;

        // *** Copy Platform to electron ***
        report_logs.push(String::from("Copying platform in to electron..."));
        let platform_dest2 = Target::App.cwd().join("node_modules").join("platform");

        fstools::rm_folder(&platform_dest2).await?;
        tokio::fs::create_dir_all(&platform_dest2)
            .await
            .with_context(|| {
                format!(
                    "Error while creating directory: {}",
                    platform_dest2.display()
                )
            })?;

        fstools::cp_many(
            platform_entries_to_copy,
            platform_dest2,
            platform_src.display(),
            &mut report_logs,
        )
        .await?;

        Ok(Some(SpawnResult::create_for_fs(
            "Copy TS Bindings and Platform to Electron".into(),
            report_logs,
        )))
    }
}
