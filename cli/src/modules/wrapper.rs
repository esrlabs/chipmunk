use super::{Kind, Manager, TestCommand};
use crate::{
    fstools,
    location::get_root,
    spawner::{spawn, SpawnOptions, SpawnResult},
    Target,
};
use anyhow::{bail, Error};
use async_trait::async_trait;
use futures::future::join_all;
use std::{fs, iter, path::PathBuf};

const PATH: &str = "application/apps/rustcore/ts-bindings";

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
        get_root().join(PATH)
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
        if !build_spec_path.join("build").exists() {
            let build_spec_cmd = format!(
                "{}/node_modules/.bin/tsc -p tsconfig.json",
                self.cwd().to_string_lossy()
            );

            let spec_res = spawn(
                build_spec_cmd,
                Some(build_spec_path),
                "bulid spec".into(),
                iter::empty(),
                None,
            )
            .await?;

            results.push(spec_res);
        }

        let test_cmds = self.test_cmds();

        let caption = format!("Test {}", self.owner());
        let spawn_results = join_all(test_cmds.into_iter().map(|cmd| {
            spawn(
                cmd.command,
                Some(cmd.cwd),
                caption.clone(),
                vec![(String::from("ELECTRON_RUN_AS_NODE"), String::from("1"))],
                cmd.spawn_opts.clone(),
            )
        }))
        .await;

        for res in spawn_results {
            match res {
                Ok(spawn_res) => results.push(spawn_res),
                Err(err) => return Err(err),
            }
        }

        Ok(results)
    }

    fn test_cmds(&self) -> Vec<TestCommand> {
        //TODO: this can be constant when "jobs" problem is solved
        let test_specs: Vec<&'static str> = vec![
            // TODO:
            // Running "jobs" here causes the program to receive SIGTRAP from OS because of an
            // out-of-memory error in electron app, even if only this job was running (by
            // commenting out the other specs)
            // "jobs" is commented out temporally until the SIGTRAP problem is solved.
            // "jobs",
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

        test_specs.iter().map(|spec| {
            TestCommand::new(
                format!("./node_modules/.bin/electron ./node_modules/jasmine/bin/jasmine.js spec/build/spec/session.{spec}.spec.js"),
                self.cwd(),
                Some(SpawnOptions{suppress_msg:true}),
            )
        }).collect()
    }
}
