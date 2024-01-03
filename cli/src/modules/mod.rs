pub mod app;
pub mod binding;
pub mod cli;
pub mod client;
pub mod core;
pub mod shared;
pub mod wasm;
pub mod wrapper;

use crate::{
    fstools,
    spawner::{spawn, SpawnOptions, SpawnResult},
    Target, LOCATION,
};
use async_trait::async_trait;
use futures::future::join_all;
use std::{io::Error, path::PathBuf};

#[derive(Debug, Clone)]
pub enum Kind {
    Ts,
    Rs,
}

impl Kind {
    pub fn build_cmd(&self, prod: bool) -> String {
        match self {
            Kind::Ts => format!("yarn run {}", if prod { "prod" } else { "build" }),
            Kind::Rs => format!(
                "cargo build --color always{}",
                if prod { " --release" } else { "" }
            ),
        }
    }
    pub fn install_cmd(&self, prod: bool) -> Option<String> {
        match self {
            Kind::Ts => Some(format!(
                "yarn install{}",
                if prod { " --production" } else { "" }
            )),
            Kind::Rs => None,
        }
    }
}

pub(crate) struct TestCommand {
    command: String,
    cwd: PathBuf,
    spawn_opts: Option<SpawnOptions>,
}

impl TestCommand {
    pub(crate) fn new(command: String, cwd: PathBuf, spawn_opts: Option<SpawnOptions>) -> Self {
        Self {
            command,
            cwd,
            spawn_opts,
        }
    }
}

#[async_trait]
pub trait Manager {
    fn kind(&self) -> Kind;
    fn owner(&self) -> Target;
    fn cwd(&self) -> PathBuf;
    fn deps(&self) -> Vec<Target>;
    fn build_cmd(&self, _prod: bool) -> Option<String> {
        None
    }
    fn install_cmd(&self, _prod: bool) -> Option<String> {
        None
    }
    fn test_cmds(&self) -> Vec<TestCommand> {
        Vec::new()
    }
    async fn reset(&self) -> Result<SpawnResult, Error> {
        self.clean().await?;
        fstools::rm_folder(self.cwd().join("dist")).await?;
        Ok(SpawnResult::empty())
    }
    async fn clean(&self) -> Result<(), Error> {
        match self.kind() {
            Kind::Ts => {
                fstools::rm_folder(self.cwd().join("node_modules")).await?;
            }
            Kind::Rs => {
                fstools::rm_folder(self.cwd().join("target")).await?;
            }
        }
        Ok(())
    }
    async fn install(&self, prod: bool) -> Result<SpawnResult, Error> {
        let cmd = if self.install_cmd(prod).is_some() {
            self.install_cmd(prod)
        } else {
            self.kind().install_cmd(prod)
        };
        if let Some(cmd) = cmd {
            spawn(&cmd, Some(self.cwd()), Some(&cmd), None).await
        } else {
            Ok(SpawnResult::empty())
        }
    }
    async fn install_if_need(&self, prod: bool) -> Result<SpawnResult, Error> {
        match self.kind() {
            Kind::Ts => {
                if self.cwd().join("node_modules").exists() {
                    Ok(SpawnResult::empty())
                } else {
                    self.install(prod).await
                }
            }
            Kind::Rs => Ok(SpawnResult::empty()),
        }
    }
    async fn after(&self) -> Result<Option<SpawnResult>, Error> {
        Ok(None)
    }
    async fn build(&self, prod: bool) -> Result<SpawnResult, Error> {
        self.install(false).await?;
        let deps: Vec<Box<dyn Manager + Sync + Send>> =
            self.deps().iter().map(|target| target.get()).collect();
        for module in deps {
            let status = module.build(prod).await?;
            if !status.status.success() {
                return Ok(status);
            }
        }
        let path = LOCATION.root.clone().join(self.cwd());
        let cmd = if let Some(cmd) = self.build_cmd(prod) {
            cmd
        } else {
            self.kind().build_cmd(prod)
        };
        match spawn(&cmd, Some(path), Some(&cmd), None).await {
            Ok(status) => {
                if !status.status.success() {
                    Ok(status)
                } else {
                    let res = self.after().await?;
                    if matches!(self.kind(), Kind::Ts) && prod {
                        self.clean().await?;
                        self.install(prod).await?;
                    }
                    if let Some(res) = res {
                        Ok(res)
                    } else {
                        Ok(SpawnResult::empty())
                    }
                }
            }
            Err(err) => Err(err),
        }
    }
    async fn check(&self) -> Result<SpawnResult, Error> {
        match self.kind() {
            Kind::Ts => {
                self.install(false).await?;
                self.lint().await
            }
            Kind::Rs => self.clippy().await,
        }
    }
    async fn lint(&self) -> Result<SpawnResult, Error> {
        let path = LOCATION.root.clone().join(self.cwd());
        let status = spawn("yarn run lint", Some(path.clone()), Some("linting"), None).await?;
        if !status.status.success() {
            return Ok(status);
        }
        spawn("yarn run build", Some(path), Some("TS compilation"), None).await
    }
    async fn clippy(&self) -> Result<SpawnResult, Error> {
        let path = LOCATION.root.clone().join(self.cwd());
        spawn(
            "cargo clippy --color always --all --all-features -- -D warnings",
            Some(path),
            Some("clippy"),
            None,
        )
        .await
    }

    // TODO: After using native rust asnyc traits, we can return a vector of results here and use
    // flat_map in main() to get rid of the double join calls
    async fn test(&self) -> Result<SpawnResult, Error> {
        self.install(false).await?;
        // TODO: Check if we need to run the dependencies tests too

        let test_cmds = self.test_cmds();
        if test_cmds.is_empty() {
            return Ok(SpawnResult::empty());
        }

        let results = join_all(test_cmds.iter().map(|cmd| {
            spawn(
                &cmd.command,
                Some(cmd.cwd.to_owned()),
                Some(&cmd.command),
                cmd.spawn_opts.clone(),
            )
        }))
        .await;

        // return the first failed result, or the first one if all was successful
        let return_pos = results
            .iter()
            .position(|res| match res {
                Ok(result) => !result.status.success(),
                Err(_) => true,
            })
            .unwrap_or(0);

        results
            .into_iter()
            .nth(return_pos)
            .expect("Commands has been checked if they are empty before spawning tasks")
    }
}
