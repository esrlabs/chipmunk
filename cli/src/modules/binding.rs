use super::{Kind, Manager};
use crate::{fstools, spawner::SpawnResult, Target};
use anyhow::{bail, Context, Error};
use async_trait::async_trait;
use std::fs;

#[derive(Clone, Debug)]
/// Represents the path `application/apps/rustcore/rs-bindings`
pub struct Module {}

impl Module {
    pub fn new() -> Self {
        Self {}
    }
}

#[async_trait]
impl Manager for Module {
    fn owner(&self) -> Target {
        Target::Binding
    }
    fn kind(&self) -> Kind {
        Kind::Rs
    }
    fn deps(&self) -> Vec<Target> {
        vec![Target::Shared]
    }

    //TODO: This is just a work around to solve installing ts bindings before biulding rs bindings
    async fn install(&self, prod: bool) -> Result<SpawnResult, Error> {
        Target::Wrapper.get().install(prod).await
    }

    fn build_cmd(&self, prod: bool) -> Option<String> {
        let mut path = Target::Wrapper.cwd();
        path.push("node_modules");
        path.push(".bin");
        path.push("electron-build-env");

        Some(format!(
            "{} nj-cli build{}",
            path.to_string_lossy(),
            //TODO: Ruby code build always in release mode
            if prod { " --release" } else { "" }
        ))
    }
    async fn after(&self, _prod: bool) -> Result<Option<SpawnResult>, Error> {
        let mut report_logs = Vec::new();

        // *** Copy `index.node` from rs to ts bindings dist ***
        report_logs.push(String::from("Copying `index.node` to ts-bindings dist..."));

        let src_file = self.owner().cwd().join("dist").join("index.node");
        if !src_file.exists() {
            bail!(
                "Error while copying `rs-bindings`. Err: Not found: {}",
                src_file.to_string_lossy()
            );
        }

        let ts_dist_native_dir = Target::Wrapper.cwd().join("dist").join("native");
        if !ts_dist_native_dir.exists() {
            let msg = format!("creating directory: {}", ts_dist_native_dir.display());
            report_logs.push(msg);

            fs::create_dir_all(&ts_dist_native_dir).with_context(|| {
                format!(
                    "Error while creating directory: {}",
                    ts_dist_native_dir.display()
                )
            })?;
        }

        fstools::cp_file(
            src_file.clone(),
            ts_dist_native_dir.join("index.node"),
            &mut report_logs,
        )
        .await?;

        // *** Copy `index.node` from rs to ts bindings src native (dir-tests) ***
        report_logs.push(String::from(
            "Copying `index.node` to ts-bindings src native...",
        ));

        let dir_tests = Target::Wrapper.cwd().join("src").join("native");
        let mod_file = dir_tests.join("index.node");

        fstools::cp_file(src_file, mod_file, &mut report_logs).await?;

        Ok(Some(SpawnResult::create_for_fs(
            "Copying `index.node` from rs to ts bindings".into(),
            report_logs,
        )))
    }
}
