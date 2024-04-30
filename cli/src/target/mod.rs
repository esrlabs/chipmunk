use anyhow::{bail, Context};
use clap::ValueEnum;
use futures::{
    future::{join_all, BoxFuture},
    FutureExt,
};
use std::{iter, path::PathBuf, str::FromStr};
use tokio::sync::oneshot;

use crate::{
    build_state::{BuildState, BuildStatesTracker},
    checksum_records::ChecksumRecords,
    dev_tools::DevTool,
    fstools,
    job_type::JobType,
    location::get_root,
    spawner::{spawn, spawn_skip, SpawnOptions, SpawnResult},
};

use target_kind::TargetKind;

mod app;
mod binding;
mod cli;
mod client;
mod core;
mod shared;
mod target_kind;
mod updater;
mod wasm;
mod wrapper;

#[derive(Debug, ValueEnum, Clone, Copy, Hash, PartialEq, Eq, PartialOrd, Ord)]
pub enum Target {
    /// Represents the path `application/apps/indexer`
    Core,
    /// Represents the path `application/apps/rustcore/rs-bindings`
    Binding,
    /// Represents the path `application/apps/rustcore/ts-bindings`
    Wrapper,
    /// Represents the path `application/client`
    Client,
    /// Represents the path `application/platform`
    Shared,
    /// Represents the path `application/holder`
    App,
    /// Represents the path `cli`
    Cli,
    /// Represents the path `application/apps/rustcore/wasm-bindings`
    Wasm,
    /// Represents the path `application/apps/precompiled/updater
    Updater,
}

pub struct TestCommand {
    command: String,
    cwd: PathBuf,
    spawn_opts: Option<SpawnOptions>,
}

impl TestCommand {
    fn new(command: String, cwd: PathBuf, spawn_opts: Option<SpawnOptions>) -> Self {
        Self {
            command,
            cwd,
            spawn_opts,
        }
    }
}

impl std::fmt::Display for Target {
    fn fmt(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result {
        write!(
            f,
            "{}",
            match self {
                Target::Core => "Core",
                Target::Wrapper => "Wrapper",
                Target::Binding => "Binding",
                Target::Cli => "Cli",
                Target::Client => "Client",
                Target::Shared => "Shared",
                Target::App => "App",
                Target::Wasm => "Wasm",
                Target::Updater => "Updater",
            }
        )
    }
}

impl FromStr for Target {
    type Err = anyhow::Error;

    fn from_str(input: &str) -> Result<Self, Self::Err> {
        type T = Target;

        if cfg!(debug_assertions) {
            // This check to remember to add the newly added enums to this function
            match T::App {
                T::Core => (),
                T::Binding => (),
                T::Wrapper => (),
                T::Client => (),
                T::Shared => (),
                T::App => (),
                T::Cli => (),
                T::Wasm => (),
                T::Updater => (),
            };
        }

        match input {
            "Core" => Ok(T::Core),
            "Wrapper" => Ok(T::Wrapper),
            "Binding" => Ok(T::Binding),
            "Cli" => Ok(T::Cli),
            "Client" => Ok(T::Client),
            "Shared" => Ok(T::Shared),
            "App" => Ok(T::App),
            "Wasm" => Ok(T::Wasm),
            "Updater" => Ok(T::Updater),
            invalid => bail!("Invalid input for Parsing Target: {invalid}"),
        }
    }
}

impl Target {
    /// Return all the available targets
    pub fn all() -> &'static [Target] {
        if cfg!(debug_assertions) {
            // This check to remember to add the newly added enums to this function
            match Target::App {
                Target::Core => (),
                Target::Binding => (),
                Target::Wrapper => (),
                Target::Client => (),
                Target::Shared => (),
                Target::App => (),
                Target::Cli => (),
                Target::Wasm => (),
                Target::Updater => (),
            };
        }

        [
            Target::Binding,
            Target::Cli,
            Target::App,
            Target::Core,
            Target::Wrapper,
            Target::Shared,
            Target::Client,
            Target::Wasm,
            Target::Updater,
        ]
        .as_slice()
    }

    /// Provides the absolute path to the target code
    pub fn cwd(&self) -> PathBuf {
        let root = get_root();
        let sub_parts = match self {
            Target::Core => ["application", "apps", "indexer"].iter(),
            Target::Binding => ["application", "apps", "rustcore", "rs-bindings"].iter(),
            Target::Wrapper => ["application", "apps", "rustcore", "ts-bindings"].iter(),
            Target::Client => ["application", "client"].iter(),
            Target::Shared => ["application", "platform"].iter(),
            Target::App => ["application", "holder"].iter(),
            Target::Cli => ["cli"].iter(),
            Target::Wasm => ["application", "apps", "rustcore", "wasm-bindings"].iter(),
            Target::Updater => ["application", "apps", "precompiled", "updater"].iter(),
        };

        let sub_path: PathBuf = sub_parts.collect();

        root.join(sub_path)
    }

    /// Provide the kind of the target between Rust or Type-Script
    pub fn kind(&self) -> TargetKind {
        match self {
            Target::Binding | Target::Core | Target::Cli | Target::Wasm | Target::Updater => {
                TargetKind::Rs
            }
            Target::Client | Target::Wrapper | Target::Shared | Target::App => TargetKind::Ts,
        }
    }

    /// Provides the target which this target depend on
    pub fn deps(&self) -> Vec<Target> {
        match self {
            Target::Core | Target::Cli | Target::Shared | Target::Wasm | Target::Updater => {
                Vec::new()
            }
            Target::Binding => vec![Target::Shared],
            Target::Wrapper => vec![Target::Binding, Target::Shared],
            Target::Client => vec![Target::Shared, Target::Wasm],
            Target::App => vec![Target::Shared, Target::Wrapper, Target::Client],
        }
    }

    /// Provide the command that should be used in to build the target
    pub async fn build_cmd(&self, prod: bool) -> String {
        match self {
            Target::Binding => binding::get_build_cmd(prod),
            Target::Wasm => wasm::get_build_cmd(prod).await,
            Target::Updater => updater::get_build_cmd().await,
            rest_targets => rest_targets.kind().build_cmd(prod).await,
        }
    }

    /// Installs the needed module to perform the development task
    pub async fn install(&self, prod: bool) -> Result<SpawnResult, anyhow::Error> {
        match self {
            // We must install ts binding tools before running rs bindings, therefore we call
            // wrapper (ts-bindings) install in the rs bindings install.
            // Since rs bindings is a dependency for ts bindings, we don't need to call to install
            // on ts bindings again.
            Target::Binding => install_general(&Target::Wrapper, prod).await,
            Target::Wrapper => Ok(SpawnResult::empty()),
            // For app we don't need --production
            Target::App => install_general(&Target::App, false).await,
            rest_targets => install_general(rest_targets, prod).await,
        }
    }

    /// Run tests for the giving the target
    pub async fn test(&self, production: bool) -> Result<Vec<SpawnResult>, anyhow::Error> {
        match self {
            Target::Wrapper => wrapper::run_test().await,
            rest_targets => rest_targets.run_test_general(production).await,
        }
    }

    /// Provides the test commands for the given target if available
    async fn test_cmds(&self, production: bool) -> Option<Vec<TestCommand>> {
        match self {
            Target::Core => Some(core::get_test_cmds(production).await),
            Target::Cli => Some(cli::get_test_cmds(production).await),
            Target::Wasm => Some(wasm::get_test_cmds().await),
            _ => None,
        }
    }

    /// run test using the general routine with `test_cmds()` method
    async fn run_test_general(&self, production: bool) -> Result<Vec<SpawnResult>, anyhow::Error> {
        let Some(test_cmds) = self.test_cmds(production).await else {
            return Ok(Vec::new());
        };

        debug_assert!(!test_cmds.is_empty());

        let mut results = Vec::new();

        // build method calls install
        let build_results = self.build(false).await?;
        results.extend(build_results);

        let caption = format!("Test {}", self);
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

    /// Perform Linting Checks on the giving target
    pub async fn check(&self) -> Result<Vec<SpawnResult>, anyhow::Error> {
        let mut results = Vec::new();
        match self.kind() {
            TargetKind::Ts => {
                let install_result = self.install(false).await?;
                let lint_restul = self.ts_lint().await?;
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

    /// Perform Linting the Building the giving target since linting Type-Script doesn't check for
    /// compiling errors
    async fn ts_lint(&self) -> Result<SpawnResult, anyhow::Error> {
        let path = get_root().join(self.cwd());
        let caption = format!("TS Lint {}", self);
        let yarn_cmd = DevTool::Yarn.path().await.to_string_lossy();
        let status = spawn(
            format!("{} run lint", yarn_cmd),
            Some(path.clone()),
            caption,
            iter::empty(),
            None,
        )
        .await?;
        if !status.status.success() {
            return Ok(status);
        }

        let caption = format!("Build {}", self);
        spawn(
            format!("{} run build", yarn_cmd),
            Some(path),
            caption,
            iter::empty(),
            None,
        )
        .await
    }

    /// Runs Clippy for the given rust target
    async fn clippy(&self) -> Result<SpawnResult, anyhow::Error> {
        let path = get_root().join(self.cwd());

        let cargo_path = DevTool::Cargo.path().await;
        let caption = format!("Clippy {}", self);
        spawn(
            format!(
                "{} clippy --color always --all --all-features -- -D warnings",
                cargo_path.to_string_lossy()
            ),
            Some(path),
            caption,
            iter::empty(),
            None,
        )
        .await
    }

    /// Clean the given target, removing it from the checksum tracker as well.
    pub async fn reset(&self, production: bool) -> anyhow::Result<Vec<SpawnResult>> {
        let checksum = ChecksumRecords::get(JobType::Clean { production }).await?;
        checksum.remove_hash_if_exist(*self);
        let mut results = Vec::new();
        let clean_result = self.clean().await?;
        results.push(clean_result);

        let dist_path = self.cwd().join("dist");

        let remove_log = format!("removing {}", dist_path.display());

        fstools::rm_folder(&dist_path).await?;

        let job = format!("Reset {}", self);

        results.push(SpawnResult::create_for_fs(job, vec![remove_log]));

        Ok(results)
    }

    async fn clean(&self) -> Result<SpawnResult, anyhow::Error> {
        let mut logs = Vec::new();
        let path = match self.kind() {
            TargetKind::Ts => self.cwd().join("node_modules"),
            TargetKind::Rs => self.cwd().join("target"),
        };

        let remove_log = format!("removing directory {}", path.display());
        logs.push(remove_log);

        fstools::rm_folder(&path).await?;

        let job = format!("Clean {}", self);

        Ok(SpawnResult::create_for_fs(job, logs))
    }

    /// Runs build considering the currently running builds and already finished ones as well.
    pub async fn build(&self, prod: bool) -> Result<Vec<SpawnResult>, anyhow::Error> {
        let build_states = BuildStatesTracker::get().await;
        let (tx_result, rx_result) = oneshot::channel();

        let mut run_build = false;
        // Check the current build state
        {
            let mut states = build_states.states_map.lock().unwrap();
            match states.get_mut(self) {
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
                    states.insert(*self, BuildState::Running(vec![tx_result]));
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
                    states.insert(*self, BuildState::Finished(build_result))
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
    fn perform_build(&self, prod: bool) -> BoxFuture<Result<Vec<SpawnResult>, anyhow::Error>> {
        // BoxFuture is needed because recursion isn't supported with async rust yet
        async move {
            let checksum_rec = ChecksumRecords::get(JobType::Build { production: prod }).await?;
            checksum_rec.register_job(*self);

            let mut results = Vec::new();
            let deps: Vec<Target> = self.deps();
            for module in deps {
                let status = module.build(prod).await.with_context(|| {
                    format!(
                        "Error while building the dependciy {} for target {}",
                        module, self
                    )
                })?;
                results.extend(status);
                if results.iter().any(|res| !res.status.success()) {
                    return Ok(results);
                }
            }
            let path = get_root().join(self.cwd());
            let cmd = self.build_cmd(prod).await;
            let caption = format!("Build {}", self);

            let mut skip_task = false;

            let all_skipped = results.iter().all(|r| {
                r.skipped.unwrap_or({
                    // Tasks with no skip info are irrelevant
                    true
                })
            });

            if all_skipped {
                skip_task = !checksum_rec.check_changed(*self)?;
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
                    let res = self.after_build(prod).await?;
                    if let Some(result) = res {
                        results.push(result);
                    }
                    if matches!(self.kind(), TargetKind::Ts) && prod {
                        let clean_res = self.clean().await?;
                        results.push(clean_res);
                        let install_res = self.install(prod).await?;
                        results.push(install_res);
                    }
                }

                Ok(results)
            }
        }
        .boxed()
    }

    /// Perform any needed copy operation after the build is done
    async fn after_build(&self, prod: bool) -> Result<Option<SpawnResult>, anyhow::Error> {
        match self {
            Target::Binding => binding::copy_index_node().await,
            Target::Wrapper => wrapper::copy_binding_to_app().await,
            Target::Shared => shared::copy_platform_to_binding().await,
            Target::App => app::copy_client_to_app(prod).await,
            _ => Ok(None),
        }
    }
}

/// run install using the general routine for the given target
async fn install_general(target: &Target, prod: bool) -> Result<SpawnResult, anyhow::Error> {
    let cmd = target.kind().install_cmd(prod).await;
    if let Some(cmd) = cmd {
        let caption = format!("Install {}", target);
        spawn(cmd, Some(target.cwd()), caption, iter::empty(), None).await
    } else {
        Ok(SpawnResult::empty())
    }
}
