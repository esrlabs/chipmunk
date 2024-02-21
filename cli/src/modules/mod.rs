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
    location::get_root,
    spawner::{spawn, SpawnOptions, SpawnResult},
    Target,
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
    fn dist_path(&self, _prod: bool) -> Option<PathBuf> {
        None
    }
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
            let caption = format!("Install {}", self.owner());
            spawn(&cmd, Some(self.cwd()), caption, None).await
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
    async fn after(&self, _prod: bool) -> Result<Option<SpawnResult>, Error> {
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
        let path = get_root().join(self.cwd());
        let cmd = self
            .build_cmd(prod)
            .unwrap_or_else(|| self.kind().build_cmd(prod));
        let caption = format!("Bulid {}", self.owner());
        match spawn(&cmd, Some(path), caption, None).await {
            Ok(mut status) => {
                if !status.status.success() {
                    Ok(status)
                } else {
                    let res = self.after(prod).await?;
                    if matches!(self.kind(), Kind::Ts) && prod {
                        self.clean().await?;
                        self.install(prod).await?;
                    }

                    if let Some(res_after) = res {
                        status.merge_with(res_after);
                    }

                    Ok(status)
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
        let path = get_root().join(self.cwd());
        let caption = format!("TS Lint {}", self.owner());
        let status = spawn("yarn run lint", Some(path.clone()), caption, None).await?;
        if !status.status.success() {
            return Ok(status);
        }

        let caption = format!("Build {}", self.owner());
        spawn("yarn run build", Some(path), caption, None).await
    }
    async fn clippy(&self) -> Result<SpawnResult, Error> {
        let path = get_root().join(self.cwd());

        let caption = format!("Clippy {}", self.owner());
        spawn(
            "cargo clippy --color always --all --all-features -- -D warnings",
            Some(path),
            caption,
            None,
        )
        .await
    }

    // flat_map in main() to get rid of the double join calls
    async fn test(&self) -> Result<SpawnResult, Error> {
        self.install(false).await?;
        // TODO: Check if we need to run the dependencies tests too

        let test_cmds = self.test_cmds();
        if test_cmds.is_empty() {
            return Ok(SpawnResult::empty());
        }

        let caption = format!("Test {}", self.owner());
        let results = join_all(test_cmds.iter().map(|cmd| {
            spawn(
                &cmd.command,
                Some(cmd.cwd.to_owned()),
                caption.clone(),
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
