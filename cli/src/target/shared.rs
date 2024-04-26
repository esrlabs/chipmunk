use std::fs;

use anyhow::Context;

use crate::{fstools, spawner::SpawnResult};

use super::Target;

pub async fn copy_platform_to_binding() -> Result<Option<SpawnResult>, anyhow::Error> {
    let mut report_logs = Vec::new();

    report_logs.push(String::from("Start Job: Copying Platform to Bindings..."));

    let platform_dest = Target::Wrapper.cwd().join("node_modules").join("platform");

    let msg = format!("Removing directory: '{}'", platform_dest.display());
    report_logs.push(msg);

    fstools::rm_folder(&platform_dest).await?;

    tokio::fs::create_dir_all(&platform_dest)
        .await
        .with_context(|| format!("Error while creating directory {}", platform_dest.display()))?;

    let source = Target::Shared.cwd();

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
            path.file_name()
                .is_some_and(|file_name| !file_name.to_string_lossy().starts_with("node_modules"))
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
