use std::{fs, path::PathBuf};

use anyhow::{bail, Context};

use crate::{fstools, jobs_runner::JobDefinition, spawner::SpawnResult, tracker::get_tracker};

use super::Target;

pub fn get_dist_path(prod: bool) -> PathBuf {
    Target::Client
        .cwd()
        .join("dist")
        .join(if prod { "release" } else { "debug" })
}

pub async fn copy_client_to_app(job_def: JobDefinition) -> Result<SpawnResult, anyhow::Error> {
    let prod = job_def.job_type.is_production().unwrap_or(false);
    let src = get_dist_path(prod);
    let dest = Target::App.cwd().join("dist");
    if !src.exists() {
        bail!("Not found: {}", src.display());
    }
    let tracker = get_tracker();
    if !dest.exists() {
        let msg = format!("creating directory: {}", dest.display());
        tracker.msg(job_def, msg);

        fs::create_dir(&dest)
            .with_context(|| format!("Error while creating directory: {}", dest.display()))?;
    }
    let prev = dest.join("client");
    if prev.exists() {
        let msg = format!("removing directory: {}", prev.display());
        tracker.msg(job_def, msg);

        fstools::rm_folder(job_def, &prev)?;
    }

    fstools::cp_folder(job_def, src.clone(), dest.clone()).await?;

    let rename_from = dest.join(
        src.file_name()
            .context("Fail to parse client artifacts path")?,
    );
    let rename_to = dest.join("client");

    // Remove the rename to directory if already exists.
    if rename_to.exists() {
        fstools::rm_folder(job_def, &rename_to)?;
    }

    let msg = format!(
        "renaming '{}' to '{}'",
        rename_from.display(),
        rename_to.display()
    );
    tracker.msg(job_def, msg);

    std::fs::rename(&rename_from, &rename_to)
        .with_context(|| format!("Error while renaming {}", rename_from.display()))?;

    let report_logs = tracker.get_logs(job_def).await?.unwrap_or_default();

    Ok(SpawnResult::create_for_fs(
        "Copy App Build Artifacts".into(),
        report_logs,
    ))
}
