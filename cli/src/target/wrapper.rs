use std::{iter, path::PathBuf};

use anyhow::anyhow;

use crate::{
    job_type::JobType,
    jobs_runner::JobDefinition,
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

pub async fn run_test(production: bool) -> Result<SpawnResult, anyhow::Error> {
    let job_def = JobDefinition::new(Target::Binding, JobType::Test { production });
    let mut final_result: Option<SpawnResult> = None;

    let cwd = Target::Wrapper.cwd();

    let build_spec_path = cwd.join("spec");
    //TODO: This check exists in rake implementation but it need to be improved.
    // The check should cover if the test themselves or the code under the tests has been changed.
    if !build_spec_path.join("build").exists() {
        let test_builder_path = cwd.join("node_modules").join(".bin").join("tsc");
        let build_spec_cmd = format!("{} -p tsconfig.json", test_builder_path.to_string_lossy());

        let spec_res = spawn(
            job_def,
            build_spec_cmd,
            Some(build_spec_path),
            iter::empty(),
            None,
        )
        .await?;

        final_result = Some(spec_res);
    }

    let electron_path: PathBuf = [".", "node_modules", ".bin", "electron"].iter().collect();
    let electron_path = electron_path.to_string_lossy();

    let jasmine_path: PathBuf = [".", "node_modules", "jasmine", "bin", "jasmine.js"]
        .iter()
        .collect();
    let jasmine_path = jasmine_path.to_string_lossy();

    let specs_dir_path: PathBuf = ["spec", "build", "spec"].iter().collect();

    for spec in TEST_SPECS {
        let spec_file_name = format!("session.{spec}.spec.js");
        let spec_file_path = specs_dir_path.join(spec_file_name);
        let command = format!(
            "{electron_path} {jasmine_path} {}",
            spec_file_path.to_string_lossy()
        );
        let res = spawn_blocking(
            job_def,
            command,
            Some(cwd.clone()),
            vec![(String::from("ELECTRON_RUN_AS_NODE"), String::from("1"))],
        )
        .await?;

        match final_result.as_mut() {
            Some(acc) => acc.append(res),
            None => final_result = Some(res),
        };
    }

    final_result.ok_or_else(|| anyhow!("Wrapper doesn't have test specs"))
}
