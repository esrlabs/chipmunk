use std::{iter, path::PathBuf};

use anyhow::Context;
use std::fs;

use crate::{
    fstools,
    spawner::{spawn, spawn_blocking, SpawnResult},
};

use super::Target;

const TEST_SPECS: [&str; 14] = [
    // TODO:
    // Running "jobs" here causes the program to receive SIGTRAP from OS because of an
    // out-of-memory error in electron app, even if only this job was running (by
    // commenting out the other specs).
    //
    // The error happens while executing  line 137 from  the file `session.jobs.spec.ts` when
    // we spawn the command using Stdio::piped() in the spawn command (line 74 in file
    // `spawner.rs`). Either Commenting out the line from `session.jobs.spec.ts` file or
    // using Stdio::inherit() in `spawner.rs` prevent this error from happening.
    //
    // The current work-around to blocking run the all the test commands sequentially using inherit
    // Stdio::inherit suspending the progress bars until all tests are done.
    "jobs",
    "search",
    "values",
    "extract",
    "ranges",
    "exporting",
    "map",
    "observe",
    "indexes",
    "concat",
    "cancel",
    "errors",
    "stream",
    "promises",
];

pub async fn run_test() -> Result<Vec<SpawnResult>, anyhow::Error> {
    let mut results = Vec::new();

    let build_results = Target::Wrapper.build(false).await?;
    results.extend(build_results);

    let cwd = Target::Wrapper.cwd();

    let build_spec_path = cwd.join("spec");
    //TODO: This check exists in rake implementation but it need to be improved.
    // The check should cover if the test themselves or the code under the tests has been changed.
    if !build_spec_path.join("build").exists() {
        let test_builder_path = cwd.join("node_modules").join(".bin").join("tsc");
        let build_spec_cmd = format!("{} -p tsconfig.json", test_builder_path.to_string_lossy());

        let spec_res = spawn(
            build_spec_cmd,
            Some(build_spec_path),
            "Build Specs".into(),
            iter::empty(),
            None,
        )
        .await?;

        results.push(spec_res);
    }

    let electron_path: PathBuf = [".", "node_modules", ".bin", "electron"].iter().collect();
    let electron_path = electron_path.to_string_lossy();

    let jasmine_path: PathBuf = [".", "node_modules", "jasmine", "bin", "jasmine.js"]
        .iter()
        .collect();
    let jasmine_path = jasmine_path.to_string_lossy();

    let specs_dir_path: PathBuf = ["spec", "build", "spec"].iter().collect();

    for spec in TEST_SPECS {
        let caption = format!("Test {}: {}", Target::Wrapper, spec);
        let spec_file_name = format!("session.{spec}.spec.js");
        let spec_file_path = specs_dir_path.join(spec_file_name);
        let command = format!(
            "{electron_path} {jasmine_path} {}",
            spec_file_path.to_string_lossy()
        );
        let res = spawn_blocking(
            command,
            Some(cwd.clone()),
            caption.clone(),
            vec![(String::from("ELECTRON_RUN_AS_NODE"), String::from("1"))],
        )
        .await?;

        results.push(res);
    }

    Ok(results)
}

pub async fn copy_binding_to_app() -> Result<Option<SpawnResult>, anyhow::Error> {
    let mut report_logs = Vec::new();

    // *** Copying TS Bindings ***
    report_logs.push(String::from("Copying ts-bindings to electron..."));
    let rustcore_dest = Target::App.cwd().join("node_modules").join("rustcore");

    fstools::rm_folder(&rustcore_dest).await?;

    let msg = format!("Removing directory: '{}'", rustcore_dest.display());
    report_logs.push(msg);

    fs::create_dir_all(&rustcore_dest)
        .with_context(|| format!("Error while creating directory {}", rustcore_dest.display()))?;

    // This part to get all the needed files and folders to copy
    let ts_source = Target::Wrapper.cwd();
    let with_context = fs::read_dir(&ts_source).with_context(|| {
        format!(
            "Error while reading directory content: {}",
            ts_source.display()
        )
    });
    let ts_entries_to_copy: Vec<_> = with_context?
        .filter_map(|entry_res| entry_res.ok().map(|entry| entry.path()))
        .filter(|path| {
            path.file_name()
                .is_some_and(|file_name| !file_name.to_string_lossy().starts_with("node_modules"))
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
    fs::create_dir_all(&platform_dest).with_context(|| {
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
            path.file_name()
                .is_some_and(|file_name| !file_name.to_string_lossy().starts_with("node_modules"))
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
    fs::create_dir_all(&platform_dest2).with_context(|| {
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
