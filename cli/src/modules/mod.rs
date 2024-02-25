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
use anyhow::Error;
use async_trait::async_trait;
use futures::future::join_all;
use std::path::PathBuf;

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
    async fn reset(&self) -> Result<Vec<SpawnResult>, Error> {
        let mut results = Vec::new();
        let clean_result = self.clean().await?;
        results.push(clean_result);

        let dist_path = self.cwd().join("dist");

        let remove_log = format!("removing {}", dist_path.display());

        fstools::rm_folder(dist_path).await?;

        let job = format!("Reset {}", self.owner());

        results.push(SpawnResult::create_for_fs(job, vec![remove_log]));

        Ok(results)
    }
    async fn clean(&self) -> Result<SpawnResult, Error> {
        let mut logs = Vec::new();
        let path = match self.kind() {
            Kind::Ts => self.cwd().join("node_modules"),
            Kind::Rs => self.cwd().join("target"),
        };

        let remove_log = format!("removing directory {}", path.display());
        logs.push(remove_log);

        fstools::rm_folder(path).await?;

        let job = format!("Clean {}", self.owner());

        Ok(SpawnResult::create_for_fs(job, logs))
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
    async fn build(&self, prod: bool) -> Result<Vec<SpawnResult>, Error> {
        let mut results = Vec::new();
        let install_result = self.install(false).await?;
        results.push(install_result);
        let deps: Vec<Box<dyn Manager + Sync + Send>> =
            self.deps().iter().map(|target| target.get()).collect();
        for module in deps {
            let status = module.build(prod).await?;
            results.extend(status);
            if results.iter().any(|res| !res.status.success()) {
                return Ok(results);
            }
        }
        let path = get_root().join(self.cwd());
        let cmd = self
            .build_cmd(prod)
            .unwrap_or_else(|| self.kind().build_cmd(prod));
        let caption = format!("Bulid {}", self.owner());
        match spawn(&cmd, Some(path), caption, None).await {
            Ok(status) => {
                if !status.status.success() {
                    results.push(status);
                    Ok(results)
                } else {
                    results.push(status);
                    let res = self.after(prod).await?;
                    if let Some(result) = res {
                        results.push(result);
                    }
                    if matches!(self.kind(), Kind::Ts) && prod {
                        let clean_res = self.clean().await?;
                        results.push(clean_res);
                        let install_res = self.install(prod).await?;
                        results.push(install_res);
                    }

                    Ok(results)
                }
            }
            Err(err) => Err(err),
        }
    }
    async fn check(&self) -> Result<Vec<SpawnResult>, Error> {
        let mut results = Vec::new();
        match self.kind() {
            Kind::Ts => {
                let install_result = self.install(false).await?;
                let lint_restul = self.lint().await?;
                results.push(install_result);
                results.push(lint_restul);
            }
            Kind::Rs => {
                let clippy_result = self.clippy().await?;
                results.push(clippy_result);
            }
        }

        Ok(results)
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

    async fn test(&self) -> Result<Vec<SpawnResult>, Error> {
        let test_cmds = self.test_cmds();
        if test_cmds.is_empty() {
            return Ok(Vec::new());
        }

        let mut results = Vec::new();

        let install_res = self.install(false).await?;
        results.push(install_res);

        let caption = format!("Test {}", self.owner());
        let spawn_results = join_all(test_cmds.iter().map(|cmd| {
            spawn(
                &cmd.command,
                Some(cmd.cwd.to_owned()),
                caption.clone(),
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
}
