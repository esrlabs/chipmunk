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
    target::TargetKind,
    Target,
};
use anyhow::{bail, Context, Error};
use async_trait::async_trait;
use std::iter;
use tokio::sync::oneshot;

#[async_trait]
pub trait Manager {
    fn owner(&self) -> Target;
    async fn reset(&self, production: bool) -> anyhow::Result<Vec<SpawnResult>> {
        let checksum = ChecksumRecords::get(JobType::Clean { production }).await?;
        checksum.remove_hash_if_exist(self.owner());
        let mut results = Vec::new();
        let clean_result = self.clean().await?;
        results.push(clean_result);

        let dist_path = self.owner().cwd().join("dist");

        let remove_log = format!("removing {}", dist_path.display());

        fstools::rm_folder(&dist_path).await?;

        let job = format!("Reset {}", self.owner());

        results.push(SpawnResult::create_for_fs(job, vec![remove_log]));

        Ok(results)
    }
    async fn clean(&self) -> Result<SpawnResult, Error> {
        let mut logs = Vec::new();
        let path = match self.owner().kind() {
            TargetKind::Ts => self.owner().cwd().join("node_modules"),
            TargetKind::Rs => self.owner().cwd().join("target"),
        };

        let remove_log = format!("removing directory {}", path.display());
        logs.push(remove_log);

        fstools::rm_folder(&path).await?;

        let job = format!("Clean {}", self.owner());

        Ok(SpawnResult::create_for_fs(job, logs))
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
        let deps: Vec<Box<dyn Manager + Sync + Send>> = self
            .owner()
            .deps()
            .iter()
            .map(|target| target.get())
            .collect();
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
        let path = get_root().join(self.owner().cwd());
        let cmd = self.owner().build_cmd(prod);
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
            let install_result = self.owner().install(false).await?;
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
                if matches!(self.owner().kind(), TargetKind::Ts) && prod {
                    let clean_res = self.clean().await?;
                    results.push(clean_res);
                    let install_res = self.owner().install(prod).await?;
                    results.push(install_res);
                }
            }

            Ok(results)
        }
    }

    async fn check(&self) -> Result<Vec<SpawnResult>, Error> {
        let mut results = Vec::new();
        match self.owner().kind() {
            TargetKind::Ts => {
                let install_result = self.owner().install(false).await?;
                let lint_restul = self.lint().await?;
                results.push(install_result);
                results.push(lint_restul);
            }
            TargetKind::Rs => {
                let clippy_result = self.clippy().await?;
                results.push(clippy_result);
            }
        }

        Ok(results)
    }
    async fn lint(&self) -> Result<SpawnResult, Error> {
        let path = get_root().join(self.owner().cwd());
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
        let path = get_root().join(self.owner().cwd());

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
}
