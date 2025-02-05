use std::{fs, iter, path::PathBuf};

use anyhow::Context;

use crate::{
    fstools,
    job_type::JobType,
    jobs_runner::JobDefinition,
    spawner::{spawn, spawn_blocking, spawn_skip, SpawnResult},
    JobsState,
};

use super::{ProcessCommand, Target};

// Naming convention for test files is `session.**.spec.[j-t]s`.
const TEST_FILES_PREFIX: &str = "session.";
const TEST_FILES_SUFFIXES: &[&str] = &[".spec.js", ".spec.ts"];

// NOTE:
// Running "jobs" here causes the program to receive SIGTRAP from OS because of an
// out-of-memory error in electron app, even if only this job was running (by
// commenting out the other specs).
//
// This error happens while executing function `jobs.getShellProfiles()` in file `session.jobs.spec.ts`
// which will call rust function `get_valid_profiles()` in `indexer/session/src/unbound/commands/shells.rs`
// using the crate `envvars` which panics with piped shells.
//
// The current work-around is blocking the progress bars temporally and running the tests
// sequentially using `Stdio::inherit` to keep using the main shell, printing the results
// of the test directly to standard out, then the progress bars will be shown again.

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

    let cancel = jobs_state.cancellation_token();

    for spec_file_path in involved_specs {
        let command = ProcessCommand::new(
            electron_path.to_string(),
            vec![jasmine_path.to_string(), spec_file_path],
        );

        // Break the loop if cancel is invoked.
        tokio::select! {
            res = spawn_blocking(
                job_def,
                command,
                Some(cwd.clone()),
                vec![(String::from("ELECTRON_RUN_AS_NODE"), String::from("1"))],
            ) => {
                let res = res?;
                final_result.append(res);
            }
            _ = cancel.cancelled() => {
                break;
            }
        }
    }

    Ok(final_result)
}
