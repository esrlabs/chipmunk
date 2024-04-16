use super::{Kind, Manager};
use crate::{
    fstools,
    location::get_root,
    spawner::{spawn, spawn_blocking, SpawnResult},
    Target,
};
use anyhow::{bail, Error};
use async_trait::async_trait;
use std::{fs, iter, path::PathBuf};

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
    fn kind(&self) -> Kind {
        Kind::Ts
    }
    fn cwd(&self) -> PathBuf {
        get_root()
            .join("application")
            .join("apps")
            .join("rustcore")
            .join("ts-bindings")
    }
    fn deps(&self) -> Vec<Target> {
        vec![Target::Binding, Target::Shared]
    }
    async fn after(&self, _prod: bool) -> Result<Option<SpawnResult>, Error> {
        let mut report_logs = Vec::new();

        let src = Target::Binding.get().cwd().join("dist").join("index.node");
        let dest = self.cwd().join("dist").join("native");
        if !src.exists() {
            bail!("Not found: {}", src.to_string_lossy());
        }
        if !dest.exists() {
            let msg = format!("creating directory: {}", dest.display());
            report_logs.push(msg);

            fs::create_dir(&dest)?;
        }

        let msg = format!(
            "copying directory: '{}' to '{}'",
            src.display(),
            dest.display()
        );
        report_logs.push(msg);

        fstools::cp_file(src, dest.join("index.node")).await?;

        Ok(Some(SpawnResult::create_for_fs(
            "Copy Wrapper Build Artifacts".into(),
            report_logs,
        )))
    }

    async fn test(&self) -> Result<Vec<SpawnResult>, Error> {
        let mut results = Vec::new();

        let build_results = self.build(false).await?;
        results.extend(build_results);

        let build_spec_path = self.cwd().join("spec");
        //TODO: This check exists in rake implementation but it need to be improved.
        // The check should cover if the test themselves or the code under the tests has been changed.
        if !build_spec_path.join("build").exists() {
            let test_builder_path = self.cwd().join("node_modules").join(".bin").join("tsc");
            let build_spec_cmd =
                format!("{} -p tsconfig.json", test_builder_path.to_string_lossy());

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

        let cwd = self.cwd();

        let electron_path: PathBuf = [".", "node_modules", ".bin", "electron"].iter().collect();
        let electron_path = electron_path.to_string_lossy();

        let jasmine_path: PathBuf = [".", "node_modules", "jasmine", "bin", "jasmine.js"]
            .iter()
            .collect();
        let jasmine_path = jasmine_path.to_string_lossy();

        let specs_dir_path: PathBuf = ["spec", "build", "spec"].iter().collect();

        for spec in TEST_SPECS {
            let caption = format!("Test {}: {}", self.owner(), spec);
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
}
