use std::{fs, iter, path::PathBuf};

use anyhow::Context;
use futures::future::join_all;

use crate::{
    JobsState, fstools,
    job_type::JobType,
    jobs_runner::JobDefinition,
    spawner::{SpawnResult, spawn, spawn_skip},
};

use super::{ProcessCommand, Target};

// Naming convention for test files is `session.**.spec.[j-t]s`.
const TEST_FILES_PREFIX: &str = "session.";
const TEST_FILES_SUFFIXES: &[&str] = &[".spec.js", ".spec.ts"];

pub async fn run_test(production: bool, skip: bool) -> Result<SpawnResult, anyhow::Error> {
    let job_def = JobDefinition::new(Target::Wrapper, JobType::Test { production });

    if skip {
        return spawn_skip(job_def, "Various test wrapper commands".into()).await;
    }

    let cwd = Target::Wrapper.cwd();

    let build_spec_path = cwd.join("spec");

    let tests_build_dir = build_spec_path.join("build");
    if tests_build_dir.exists() {
        fstools::rm_folder(job_def, &tests_build_dir)?;
    }

    // Finding tsc path on different platforms
    let test_runner_path = cwd.join("node_modules").join(".bin").join("tsc");

    let build_spec_cmd = ProcessCommand::new(
        test_runner_path.to_string_lossy().to_string(),
        vec![String::from("-p"), String::from("tsconfig.json")],
    );

    let spec_res = spawn(
        job_def,
        build_spec_cmd,
        Some(build_spec_path),
        iter::empty(),
        None,
    )
    .await?;

    let mut final_result = spec_res;

    let electron_path: PathBuf = cwd.join("node_modules").join(".bin").join("electron");

    let electron_path = electron_path.to_string_lossy();

    let jasmine_path: PathBuf = [".", "node_modules", "jasmine", "bin", "jasmine.js"]
        .iter()
        .collect();
    let jasmine_path = jasmine_path.to_string_lossy();

    let jobs_state = JobsState::get();

    let custom_specs = jobs_state.custom_specs();

    // The users have option here to provide the path of their specifications to run tests on.
    // Otherwise All test files from spec directory with names matching the naming convention
    // will be picked.
    let involved_specs = if custom_specs.is_empty() {
        let specs_path = cwd.join("spec").join("build").join("spec");

        // Read all files in the specs directory and pick the matching test files.
        let standard_specs: Vec<_> = fs::read_dir(&specs_path)
            .with_context(|| {
                format!(
                    "Failed to retrieve test spec files from directory: {}",
                    specs_path.display()
                )
            })?
            .filter_map(|e| e.ok())
            .filter(|e| e.file_type().is_ok_and(|t| t.is_file()))
            .filter(|e| {
                let file_name = e.file_name();
                let file_name = file_name.to_string_lossy();
                file_name.starts_with(TEST_FILES_PREFIX)
                    && TEST_FILES_SUFFIXES.iter().any(|s| file_name.ends_with(s))
            })
            .filter_map(|e| {
                e.path()
                    .strip_prefix(&cwd) // Test command takes the relative path of test files
                    .map(|p| p.to_string_lossy().to_string())
                    .ok()
            })
            .collect();

        standard_specs
    } else {
        custom_specs.to_vec()
    };

    let jobs = involved_specs.into_iter().map(|spec_file_path| {
        let electron_cmd = electron_path.to_string();
        let jasmine_arg = jasmine_path.to_string();
        let cwd_path = cwd.clone();

        let command = ProcessCommand::new(electron_cmd, vec![jasmine_arg, spec_file_path]);

        spawn(
            job_def,
            command,
            Some(cwd_path),
            vec![(String::from("ELECTRON_RUN_AS_NODE"), String::from("1"))],
            None,
        )
    });

    let spawn_results = join_all(jobs).await;

    for result in spawn_results {
        let spawn_res = result?;

        final_result.append(spawn_res);
    }

    Ok(final_result)
}
