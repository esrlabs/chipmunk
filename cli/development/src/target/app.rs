use std::fs;

use anyhow::{ensure, Context};

use crate::{fstools, jobs_runner::JobDefinition, spawner::SpawnResult, tracker::get_tracker};

use super::Target;

pub async fn copy_package_file_to_dist(
    job_def: JobDefinition,
) -> Result<SpawnResult, anyhow::Error> {
    const PACKAGE_FILE_NAME: &str = "package.json";

    let package_file_path = Target::App.cwd().join(PACKAGE_FILE_NAME);

    ensure!(
        package_file_path.exists(),
        "Package.json File doesn't exist in App. Path: {}",
        package_file_path.display()
    );
    let tracker = get_tracker();

    let dist = Target::App.cwd().join("dist");
    if !dist.exists() {
        let msg = format!("Creating directory: {}", dist.display());
        tracker.msg(job_def, msg);

        fs::create_dir(&dist)
            .with_context(|| format!("Error while creating directory: {}", dist.display()))?;
    }

    fstools::cp_file(job_def, package_file_path, dist.join(PACKAGE_FILE_NAME))?;

    let report_logs = tracker.get_logs(job_def).await?.unwrap_or_default();

    let spawn_res = SpawnResult::create_for_fs(
        "Copy `package.json` file to holder/dest directory".into(),
        report_logs,
    );

    Ok(spawn_res)
}
