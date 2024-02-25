use super::{Kind, Manager};
use crate::{fstools, location::get_root, spawner::SpawnResult, Target};
use anyhow::{bail, Error};
use async_trait::async_trait;
use std::{fs, path::PathBuf, process::ExitStatus};

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
    async fn after(&self, _prod: bool, report: bool) -> Result<Option<SpawnResult>, Error> {
        let mut report_logs = Vec::new();

        let src = Target::Binding.get().cwd().join("dist/index.node");
        let dest = self.cwd().join("dist/native");
        if !src.exists() {
            bail!("Not found: {}", src.to_string_lossy());
        }
        if !dest.exists() {
            if report {
                let msg = format!("creating directory: {}", dest.display());
                report_logs.push(msg);
            }
            fs::create_dir(&dest)?;
        }

        if report {
            let msg = format!(
                "copying directory: '{}' to '{}'",
                src.display(),
                dest.display()
            );
            report_logs.push(msg);
        }

        fstools::cp_file(src, dest.join("index.node")).await?;

        Ok(Some(SpawnResult {
            report: report_logs,
            status: ExitStatus::default(),
            job: "Copy Wrapper Build Artifacts".into(),
            cmd: "Multiple file system commands".into(),
        }))
    }
}
