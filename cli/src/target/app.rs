use std::fs;

use anyhow::{bail, Context};

use crate::{fstools, jobs_runner::JobDefinition, spawner::SpawnResult};

use super::{client::get_dist_path, Target};

pub async fn copy_client_to_app(job_def: JobDefinition) -> Result<SpawnResult, anyhow::Error> {
    let mut report_logs = Vec::new();
    let prod = job_def.job_type.is_production().unwrap_or(false);
    let src = get_dist_path(prod);
    let dest = Target::App.cwd().join("dist");
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

        fstools::rm_folder(job_def, &prev)?;
    }

    fstools::cp_folder(job_def, src.clone(), dest.clone(), &mut report_logs).await?;

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

    Ok(SpawnResult::create_for_fs(
        "Copy App Build Artifacts".into(),
        report_logs,
    ))
}
