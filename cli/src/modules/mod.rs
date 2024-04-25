pub mod app;
pub mod binding;
pub mod cli;
pub mod client;
pub mod core;
pub mod shared;
pub mod wasm;
pub mod wrapper;

use crate::{
    build_state::{BuildState, BuildStatesTracker},
    checksum_records::ChecksumRecords,
    fstools,
    job_type::JobType,
    location::get_root,
    spawner::{spawn, spawn_skip, SpawnOptions, SpawnResult},
    Target,
};
use anyhow::{bail, Context, Error};
use async_trait::async_trait;
use futures::future::join_all;
use std::{iter, path::PathBuf};
use tokio::sync::oneshot;

#[derive(Debug, Clone)]
pub enum Kind {
    /// TypeScript
    Ts,
    /// Rust
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
    fn test_cmds(&self, _production: bool) -> Vec<TestCommand> {
        Vec::new()
    }
    async fn reset(&self, production: bool) -> anyhow::Result<Vec<SpawnResult>> {
        let checksum = ChecksumRecords::get(JobType::Clean { production }).await?;
        checksum.remove_hash_if_exist(self.owner());
        let mut results = Vec::new();
        let clean_result = self.clean().await?;
        results.push(clean_result);

        let dist_path = self.cwd().join("dist");

        let remove_log = format!("removing {}", dist_path.display());

        fstools::rm_folder(&dist_path).await?;

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

        fstools::rm_folder(&path).await?;

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
            spawn(cmd, Some(self.cwd()), caption, iter::empty(), None).await
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

    /// Runs build considering the currently running builds and already finished ones as well.
    async fn build(&self, prod: bool) -> Result<Vec<SpawnResult>, Error> {
        let build_states = BuildStatesTracker::get().await;
        let (tx_result, rx_result) = oneshot::channel();

        let target = self.owner();
        let mut run_build = false;
        // Check the current build state
        {
            let mut states = build_states.states_map.lock().unwrap();
            match states.get_mut(&target) {
                Some(BuildState::Running(senders)) => {
                    // If the build is currently running, add the sender to senders list so it get
                    // the results when the job is done;
                    senders.push(tx_result);
                }
                Some(BuildState::Finished(build_result)) => {
                    // If Build is already finished, then return the results directly
                    match build_result {
                        Ok(res) => return Ok(res.clone()),
                        Err(err) => bail!(err.to_string()),
                    }
                }
                None => {
                    // Run the build and add the sender to the list.
                    run_build = true;
                    states.insert(target, BuildState::Running(vec![tx_result]));
                }
            }
        }

        if run_build {
            // Run the build
            let build_result = self.perform_build(prod).await;
            // Update the build state and notify all the senders
            {
                let mut states = build_states.states_map.lock().unwrap();

                let res_clone = match &build_result {
                    Ok(spawn_res) => Ok(spawn_res.clone()),
                    Err(err) => Err(anyhow::anyhow!("{:?}", err)),
                };

                let Some(BuildState::Running(senders)) =
                    states.insert(target, BuildState::Finished(build_result))
                else {
                    unreachable!("State after calling build must be renning");
                };

                for sender in senders {
                    let res_clone = match &res_clone {
                        Ok(spawn_res) => Ok(spawn_res.clone()),
                        Err(err) => Err(anyhow::anyhow!("{:?}", err)),
                    };
                    if sender.send(res_clone).is_err() {
                        bail!("Fail to communicate with builder");
                    }
                }
            }
        }

        rx_result
            .await
            .context("Fail to communicate with builder")?
    }

    /// Performs build process without checking the current builds states
    async fn perform_build(&self, prod: bool) -> Result<Vec<SpawnResult>, Error> {
        let checksum_rec = ChecksumRecords::get(JobType::Build { production: prod }).await?;
        checksum_rec.register_job(self.owner());

        let mut results = Vec::new();
        let deps: Vec<Box<dyn Manager + Sync + Send>> =
            self.deps().iter().map(|target| target.get()).collect();
        for module in deps {
            let status = module.build(prod).await.with_context(|| {
                format!(
                    "Error while building the dependciy {} for target {}",
                    module.owner(),
                    self.owner()
                )
            })?;
            results.extend(status);
            if results.iter().any(|res| !res.status.success()) {
                return Ok(results);
            }
        }
        let path = get_root().join(self.cwd());
        let cmd = self
            .build_cmd(prod)
            .unwrap_or_else(|| self.kind().build_cmd(prod));
        let caption = format!("Build {}", self.owner());

        let mut skip_task = false;

        let all_skipped = results.iter().all(|r| {
            r.skipped.unwrap_or({
                // Tasks with no skip info are irrelevant
                true
            })
        });

        if all_skipped {
            skip_task = !checksum_rec.check_changed(self.owner())?;
        }

        let spawn_reslt = if skip_task {
            spawn_skip(cmd, Some(path), caption).await
        } else {
            let install_result = self.install(false).await?;
            results.push(install_result);
            let spawn_opt = SpawnOptions {
                has_skip_info: true,
                ..Default::default()
            };
            spawn(cmd, Some(path), caption, iter::empty(), Some(spawn_opt)).await
        };

        let status = spawn_reslt?;

        if !status.status.success() {
            results.push(status);
            Ok(results)
        } else {
            results.push(status);
            if !skip_task {
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
            }

            Ok(results)
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
        let status = spawn(
            "yarn run lint".into(),
            Some(path.clone()),
            caption,
            iter::empty(),
            None,
        )
        .await?;
        if !status.status.success() {
            return Ok(status);
        }

        let caption = format!("Build {}", self.owner());
        spawn(
            "yarn run build".into(),
            Some(path),
            caption,
            iter::empty(),
            None,
        )
        .await
    }
    async fn clippy(&self) -> Result<SpawnResult, Error> {
        let path = get_root().join(self.cwd());

        let caption = format!("Clippy {}", self.owner());
        spawn(
            "cargo clippy --color always --all --all-features -- -D warnings".into(),
            Some(path),
            caption,
            iter::empty(),
            None,
        )
        .await
    }

    async fn test(&self, production: bool) -> Result<Vec<SpawnResult>, Error> {
        let test_cmds = self.test_cmds(production);
        if test_cmds.is_empty() {
            return Ok(Vec::new());
        }

        let mut results = Vec::new();

        // build method calls install
        let build_results = self.build(false).await?;
        results.extend(build_results);

        let caption = format!("Test {}", self.owner());
        let spawn_results = join_all(test_cmds.into_iter().map(|cmd| {
            spawn(
                cmd.command,
                Some(cmd.cwd),
                caption.clone(),
                iter::empty(),
                cmd.spawn_opts,
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
