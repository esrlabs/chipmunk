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

        let src = Target::Binding.get().cwd().join("dist/index.node");
        let dest = self.cwd().join("dist/native");
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
        //TODO: Make sure we should put this check here. This check exists in rake implementation
        // but it could lead to wrong test values when the changes in the tests aren't built.
        if !build_spec_path.join("build").exists() {
            let build_spec_cmd = format!(
                "{}/node_modules/.bin/tsc -p tsconfig.json",
                self.cwd().to_string_lossy()
            );

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

        for spec in TEST_SPECS {
            let caption = format!("Test {}: {}", self.owner(), spec);
            let command = format!("./node_modules/.bin/electron ./node_modules/jasmine/bin/jasmine.js spec/build/spec/session.{spec}.spec.js");
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
