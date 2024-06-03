use anyhow::bail;
use clap::ValueEnum;
use futures::future::join_all;
use std::{iter, path::PathBuf, str::FromStr};

use crate::{
    checksum_records::ChecksumRecords,
    dev_tools::DevTool,
    fstools,
    job_type::JobType,
    jobs_runner::JobDefinition,
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
//NOTE: The order of targets must match the running-order between them because it's used for
// solving their dependencies-graph using BTreeMap
pub enum Target {
    /// Represents the path `application/apps/indexer`
    Core,
    /// Represents the path `application/platform`
    Shared,
    /// Represents the path `application/apps/rustcore/rs-bindings`
    Binding,
    /// Represents the path `application/apps/rustcore/ts-bindings`
    Wrapper,
    /// Represents the path `application/apps/rustcore/wasm-bindings`
    Wasm,
    /// Represents the path `application/client`
    Client,
    /// Represents the path `application/holder`
    App,
    /// Represents the path `cli`
    Cli,
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
        let relative_path = self.relative_cwd();

        root.join(relative_path)
    }

    pub fn relative_cwd(&self) -> PathBuf {
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

        sub_parts.collect()
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

    pub fn has_job(&self, job_type: &JobType) -> bool {
        match job_type {
            JobType::Lint | JobType::Clean | JobType::Build { production: _ } => true,
            JobType::Install { production: _ } => {
                matches!(
                    self,
                    Target::Binding | Target::Client | Target::Shared | Target::App
                )
            }
            JobType::AfterBuild { production: _ } => matches!(
                self,
                Target::Shared | Target::Binding | Target::Wrapper | Target::App
            ),
            JobType::Test { production: _ } => matches!(
                self,
                Target::Wrapper | Target::Core | Target::Cli | Target::Wasm
            ),
            JobType::Run { production: _ } => false,
        }
    }

    /// Provide the command that should be used in to build the target
    pub async fn build_cmd(&self, prod: bool) -> anyhow::Result<String> {
        let build_cmd = match self {
            Target::Binding => binding::get_build_cmd(prod)?,
            Target::Wasm => wasm::get_build_cmd(prod).await,
            Target::Updater => updater::get_build_cmd().await,
            rest_targets => rest_targets.kind().build_cmd(prod).await,
        };

        Ok(build_cmd)
    }

    /// Installs the needed module to perform the development task
    pub async fn install(
        &self,
        prod: bool,
        skip: bool,
    ) -> Option<Result<SpawnResult, anyhow::Error>> {
        if skip {
            return Some(
                spawn_skip(
                    JobDefinition::new(*self, JobType::Install { production: prod }),
                    format!("Install command for {self}"),
                )
                .await,
            );
        }

        match self {
            // We must install ts binding tools before running rs bindings, therefore we call
            // wrapper (ts-bindings) install in the rs bindings install.
            // Since rs bindings is a dependency for ts bindings, we don't need to call to install
            // on ts bindings again.
            Target::Binding => {
                install_general(
                    &Target::Wrapper,
                    prod,
                    Some(JobDefinition::new(
                        Target::Binding,
                        JobType::Install { production: prod },
                    )),
                )
                .await
            }
            Target::Wrapper => None,
            // For app we don't need --production, but we still needed to be defined to comunicate
            // with UI bars
            Target::App => {
                install_general(
                    &Target::App,
                    false,
                    Some(JobDefinition::new(
                        *self,
                        JobType::Install { production: prod },
                    )),
                )
                .await
            }
            rest_targets => install_general(rest_targets, prod, None).await,
        }
    }

    /// Run tests for the giving the target
    pub async fn test(&self, production: bool) -> Option<Result<SpawnResult, anyhow::Error>> {
        match self {
            Target::Wrapper => Some(wrapper::run_test(production).await),
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
    async fn run_test_general(
        &self,
        production: bool,
    ) -> Option<Result<SpawnResult, anyhow::Error>> {
        let test_cmds = self.test_cmds(production).await?;

        debug_assert!(!test_cmds.is_empty());

        let job_def = JobDefinition::new(*self, JobType::Test { production });
        let spawn_results = join_all(test_cmds.into_iter().map(|cmd| {
            spawn(
                job_def,
                cmd.command,
                Some(cmd.cwd),
                iter::empty(),
                cmd.spawn_opts,
            )
        }))
        .await;

        let mut spawn_results = spawn_results.into_iter();

        let mut result = match spawn_results.next()? {
            Ok(result) => result,
            Err(err) => return Some(Err(err)),
        };

        while let Some(next_result) = spawn_results.next() {
            match next_result {
                Ok(next_res) => result.append(next_res),
                Err(err) => return Some(Err(err)),
            }
        }

        Some(Ok(result))
    }

    /// Perform Linting Checks on the giving target
    pub async fn check(&self) -> Result<SpawnResult, anyhow::Error> {
        match self.kind() {
            TargetKind::Ts => self.ts_lint().await,
            TargetKind::Rs => self.clippy().await,
        }
    }

    /// Perform Linting the Building the giving target since linting Type-Script doesn't check for
    /// compiling errors
    async fn ts_lint(&self) -> Result<SpawnResult, anyhow::Error> {
        let path = self.cwd();
        let yarn_cmd = DevTool::Yarn.path().await.to_string_lossy();
        let job_def = JobDefinition::new(*self, JobType::Lint);
        let status = spawn(
            job_def,
            format!("{} run lint", yarn_cmd),
            Some(path.clone()),
            iter::empty(),
            None,
        )
        .await?;
        if !status.status.success() {
            return Ok(status);
        }

        spawn(
            job_def,
            format!("{} run build", yarn_cmd),
            Some(path),
            iter::empty(),
            None,
        )
        .await
    }

    /// Runs Clippy for the given rust target
    async fn clippy(&self) -> Result<SpawnResult, anyhow::Error> {
        let path = get_root().join(self.cwd());

        let cargo_path = DevTool::Cargo.path().await;
        let job_def = JobDefinition::new(*self, JobType::Lint);
        spawn(
            job_def,
            format!(
                "{} clippy --color always --all --all-features -- -D warnings",
                cargo_path.to_string_lossy()
            ),
            Some(path),
            iter::empty(),
            None,
        )
        .await
    }

    /// Clean the given target, removing it from the checksum tracker as well.
    pub async fn reset(&self) -> anyhow::Result<SpawnResult> {
        let job_def = JobDefinition::new(*self, JobType::Clean);

        // Clean doesn't differentiate between development and production, and both of them will be
        // cleaned from the files when the data are persisted.
        let checksum = ChecksumRecords::get(false).await?;
        checksum.remove_hash_if_exist(*self)?;

        let mut logs = Vec::new();
        let path = match self.kind() {
            TargetKind::Ts => self.cwd().join("node_modules"),
            TargetKind::Rs => self.cwd().join("target"),
        };

        let remove_log = format!("removing directory {}", path.display());
        logs.push(remove_log);

        fstools::rm_folder(job_def, &path).await?;

        let dist_path = self.cwd().join("dist");
        let remove_log = format!("removing {}", dist_path.display());
        logs.push(remove_log);
        fstools::rm_folder(job_def, &dist_path).await?;

        let job = format!("Clean {}", self);

        Ok(SpawnResult::create_for_fs(job, logs))
    }

    /// Runs build considering the currently running builds and already finished ones as well.
    pub async fn build(&self, prod: bool, skip: bool) -> Result<SpawnResult, anyhow::Error> {
        let path = get_root().join(self.cwd());
        let cmd = self.build_cmd(prod).await?;

        let spawn_opt = SpawnOptions {
            has_skip_info: true,
            ..Default::default()
        };

        let job_def = JobDefinition::new(*self, JobType::Build { production: prod });

        if skip {
            spawn_skip(job_def, cmd).await
        } else {
            spawn(job_def, cmd, Some(path), iter::empty(), Some(spawn_opt)).await
        }
    }

    /// Performs build process without checking the current builds states

    /// Perform any needed copy operation after the build is done
    pub async fn after_build(
        &self,
        prod: bool,
        skip: bool,
    ) -> Option<Result<SpawnResult, anyhow::Error>> {
        let job_def = JobDefinition::new(*self, JobType::AfterBuild { production: prod });

        if skip {
            return Some(spawn_skip(job_def, "Multiple file system commands".into()).await);
        }

        let res = match self {
            Target::Binding => binding::copy_index_node(job_def).await,
            Target::Wrapper => wrapper::copy_binding_to_app(job_def).await,
            Target::Shared => shared::copy_platform_to_binding(job_def).await,
            Target::App => app::copy_client_to_app(job_def).await,
            _ => return None,
        };

        Some(res)
    }
}

/// run install using the general routine for the given target
/// * `target`: job target to perform its after build jobs
/// * `prod`: build for production
/// * `overridden_job_def`: override job definition to update tracker message. This is used when
/// target is used for another install command which happens currently with bindings and wrapper
/// targets
async fn install_general(
    target: &Target,
    prod: bool,
    overridden_job_def: Option<JobDefinition>,
) -> Option<Result<SpawnResult, anyhow::Error>> {
    let cmd = target.kind().install_cmd(prod).await;
    let job_def = overridden_job_def.unwrap_or(JobDefinition::new(
        *target,
        JobType::Install { production: prod },
    ));

    if let Some(cmd) = cmd {
        let res = spawn(job_def, cmd, Some(target.cwd()), iter::empty(), None).await;
        Some(res)
    } else {
        None
    }
}