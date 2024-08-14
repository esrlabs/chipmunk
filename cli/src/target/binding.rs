use std::fs;

use anyhow::{bail, Context};

use crate::{fstools, jobs_runner::JobDefinition, spawner::SpawnResult, tracker::get_tracker};

use super::{ProcessCommand, Target};

pub fn get_build_cmd(prod: bool) -> anyhow::Result<ProcessCommand> {
    let mut path = Target::Wrapper.cwd();
    path.push("node_modules");
    path.push(".bin");

    if cfg!(windows) {
        // The script files can get the extension '*.cmd' on Windows
        let electron_build_env_path = which::which_in("electron-build-env", Some(&path), &path)
            .context("Error while resolving electron bin path on Windows")?;
        path = electron_build_env_path;
    } else {
        path.push("electron-build-env");
    }

    let mut args = vec![String::from("nj-cli"), String::from("build")];

    if prod {
        args.push("--release".into());
    }
    Ok(ProcessCommand::new(
        path.to_string_lossy().to_string(),
        args,
    ))
}

pub async fn copy_index_node(job_def: JobDefinition) -> Result<SpawnResult, anyhow::Error> {
    let tracker = get_tracker();

    // *** Copy `index.node` from rs to ts bindings dist ***
    tracker.msg(
        job_def,
        String::from("Copying `index.node` to ts-bindings dist..."),
    );

    let src_file = Target::Binding.cwd().join("dist").join("index.node");
    if !src_file.exists() {
        bail!(
            "Error while copying `rs-bindings`. Err: Not found: {}",
            src_file.to_string_lossy()
        );
    }

    let ts_dist_native_dir = Target::Wrapper.cwd().join("dist").join("native");
    if !ts_dist_native_dir.exists() {
        let msg = format!("creating directory: {}", ts_dist_native_dir.display());
        tracker.msg(job_def, msg);

        fs::create_dir_all(&ts_dist_native_dir).with_context(|| {
            format!(
                "Error while creating directory: {}",
                ts_dist_native_dir.display()
            )
        })?;
    }

    fstools::cp_file(
        job_def,
        src_file.clone(),
        ts_dist_native_dir.join("index.node"),
    )?;

    // *** Copy `index.node` from rs to ts bindings src native (dir-tests) ***
    tracker.msg(
        job_def,
        String::from("Copying `index.node` to ts-bindings src native..."),
    );

    let dir_tests = Target::Wrapper.cwd().join("src").join("native");
    let mod_file = dir_tests.join("index.node");

    fstools::cp_file(job_def, src_file, mod_file)?;

    let report_logs = tracker.get_logs(job_def).await?.unwrap_or_default();

    Ok(SpawnResult::create_for_fs(
        "Copying `index.node` from rs to ts bindings".into(),
        report_logs,
    ))
}
