//! Manages the definitions of the targets of the jobs providing all the needed methods for
//! each target to run the needed job on it.

use anyhow::bail;
use clap::ValueEnum;
use futures::future::join_all;
use serde::{Deserialize, Serialize};
use std::{borrow::Cow, collections::BTreeSet, fmt::Display, iter, path::PathBuf, str::FromStr};
use tokio::fs;

use crate::{
    build_state_records::BuildStateRecords,
    dev_tools::DevTool,
    fstools,
    job_type::JobType,
    jobs_runner::JobDefinition,
    location::get_root,
    spawner::{spawn, spawn_skip, SpawnOptions, SpawnResult},
    tracker::get_tracker,
    JobsState,
};

use target_kind::TargetKind;

mod app;
mod binding;
mod client;
mod protocol;
mod target_kind;
mod updater;
mod wasm;
mod wrapper;

#[derive(
    Debug, ValueEnum, Clone, Copy, Hash, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize,
)]
// * NOTE: The order of targets must match the running-order between them because it's used for
// solving their dependencies-graph using BTreeMap
//
// * NOTE: We provide all targets with match arms without using wild-card matching nor
// `matches!()` macro to keep the compiler assistance when adding new targets.
pub enum Target {
    /// Represents the path `application/apps/indexer`
    Core,
    /// Represents the path `application/platform`
    Shared,
    /// Represents the path `application/apps/protocol`
    Protocol,
    /// Represents the path `application/apps/rustcore/rs-bindings`
    Binding,
    /// Represents the path `application/apps/rustcore/ts-bindings`
    Wrapper,
    /// Represents the path `application/apps/rustcore/wasm-bindings`
    Wasm,
    /// Represents the path `application/client`
    Client,
    /// Represents the path `application/apps/precompiled/updater`
    Updater,
    /// Represents the path `application/holder`
    App,
    /// Represents the path `cli/development-cli`
    CliDev,
    /// Represents the path `cli/chipmunk-cli`
    CliChipmunk,
}

#[derive(Debug, Clone)]
/// Represents a command to run with `process::Command` and its arguments
pub struct ProcessCommand {
    pub cmd: Cow<'static, str>,
    pub args: Vec<String>,
}

impl ProcessCommand {
    pub fn new(cmd: impl Into<Cow<'static, str>>, args: Vec<String>) -> Self {
        Self {
            cmd: cmd.into(),
            args,
        }
    }

    /// Combines the command and its arguments in one line to be used as a shell command.
    pub fn combine(&self) -> String {
        format!("{} {}", self.cmd, self.args.join(" "))
    }
}

impl Display for ProcessCommand {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{} {}", self.cmd, self.args.join(" "))
    }
}

#[derive(Debug, Clone)]
/// Represents command and spawns infos to run with `Target::Test`
pub struct TestSpawnCommand {
    command: ProcessCommand,
    cwd: PathBuf,
    spawn_opts: Option<SpawnOptions>,
}

impl TestSpawnCommand {
    fn new(command: ProcessCommand, cwd: PathBuf, spawn_opts: Option<SpawnOptions>) -> Self {
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
                Target::Protocol => "Protocol",
                Target::Binding => "Binding",
                Target::CliDev => "Development-Cli",
                Target::CliChipmunk => "Chipmunk-Cli",
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
                T::Protocol => (),
                T::Binding => (),
                T::Wrapper => (),
                T::Client => (),
                T::Shared => (),
                T::App => (),
                T::CliDev => (),
                T::Wasm => (),
                T::Updater => (),
                T::CliChipmunk => (),
            };
        }

        match input {
            "Core" => Ok(T::Core),
            "Wrapper" => Ok(T::Wrapper),
            "Protocol" => Ok(T::Protocol),
            "Binding" => Ok(T::Binding),
            "Development-Cli" => Ok(T::CliDev),
            "Chipmunk-Cli" => Ok(T::CliChipmunk),
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
                Target::Protocol => (),
                Target::Binding => (),
                Target::Wrapper => (),
                Target::Client => (),
                Target::Shared => (),
                Target::App => (),
                Target::CliDev => (),
                Target::Wasm => (),
                Target::Updater => (),
                Target::CliChipmunk => (),
            };
        }

        [
            Target::Binding,
            Target::Protocol,
            Target::CliDev,
            Target::App,
            Target::Core,
            Target::Wrapper,
            Target::Shared,
            Target::Client,
            Target::Wasm,
            Target::Updater,
            Target::CliChipmunk,
        ]
        .as_slice()
    }

    /// Provides the absolute path to the target
    pub fn cwd(self) -> PathBuf {
        let root = get_root();
        let relative_path = self.relative_cwd();

        root.join(relative_path)
    }

    /// Provides the relative path to the target starting from chipmunk root directory
    pub fn relative_cwd(self) -> PathBuf {
        let sub_parts = match self {
            Target::Core => ["application", "apps", "indexer"].iter(),
            Target::Protocol => ["application", "apps", "protocol"].iter(),
            Target::Binding => ["application", "apps", "rustcore", "rs-bindings"].iter(),
            Target::Wrapper => ["application", "apps", "rustcore", "ts-bindings"].iter(),
            Target::Client => ["application", "client"].iter(),
            Target::Shared => ["application", "platform"].iter(),
            Target::App => ["application", "holder"].iter(),
            Target::CliDev => ["cli", "development-cli"].iter(),
            Target::CliChipmunk => ["cli", "chipmunk-cli"].iter(),
            Target::Wasm => ["application", "apps", "rustcore", "wasm-bindings"].iter(),
            Target::Updater => ["application", "apps", "precompiled", "updater"].iter(),
        };

        sub_parts.collect()
    }

    /// Provide the kind of the target between Rust or Type-Script
    pub fn kind(self) -> TargetKind {
        match self {
            Target::Protocol
            | Target::Binding
            | Target::Core
            | Target::CliDev
            | Target::CliChipmunk
            | Target::Wasm
            | Target::Updater => TargetKind::Rs,
            Target::Client | Target::Wrapper | Target::Shared | Target::App => TargetKind::Ts,
        }
    }

    /// Provides the targets which this target directly depend on
    pub fn direct_deps(self) -> Vec<Target> {
        match self {
            Target::Core
            | Target::CliDev
            // Cargo take care of the dependency between indexer and the CLI tool, 
            // it's not need to be resolved manually in this tool.
            | Target::CliChipmunk
            | Target::Shared
            | Target::Wasm
            | Target::Updater => Vec::new(),
            Target::Protocol => vec![Target::Core],
            Target::Binding => vec![Target::Shared, Target::Core, Target::Protocol],
            Target::Wrapper => vec![Target::Binding, Target::Shared, Target::Protocol],
            Target::Client => vec![Target::Shared, Target::Wasm, Target::Protocol],
            Target::App => vec![Target::Wrapper, Target::Client, Target::Updater],
        }
    }

    /// Provides all the dependencies of this target and its dependencies recursively.
    pub fn flatten_deps(self) -> BTreeSet<Target> {
        fn flatten_rec(target: Target, involved_targets: &mut BTreeSet<Target>) {
            if !involved_targets.insert(target) {
                return;
            }
            for involved_target in target.direct_deps() {
                flatten_rec(involved_target, involved_targets);
            }
        }

        let mut resolved_targets = BTreeSet::new();
        for target in self.direct_deps() {
            flatten_rec(target, &mut resolved_targets);
        }

        resolved_targets
    }

    /// Returns if the current target has a job to the given job type
    pub fn has_job(self, job_type: JobType) -> bool {
        match job_type {
            JobType::Lint | JobType::Clean | JobType::Build { .. } => true,

            JobType::Install { .. } => match self {
                Target::Binding | Target::Client | Target::Shared | Target::App | Target::Wasm => {
                    true
                }
                Target::Core
                | Target::Wrapper
                | Target::Updater
                | Target::CliDev
                | Target::CliChipmunk
                | Target::Protocol => false,
            },

            JobType::AfterBuild { .. } => match self {
                Target::Binding | Target::Client | Target::App => true,
                Target::Core
                | Target::Shared
                | Target::Wrapper
                | Target::Wasm
                | Target::Updater
                | Target::CliDev
                | Target::CliChipmunk
                | Target::Protocol => false,
            },
            JobType::Test { .. } => match self {
                Target::Wrapper
                | Target::Core
                | Target::CliDev
                | Target::Wasm
                | Target::CliChipmunk => true,
                Target::Shared
                | Target::Binding
                | Target::Client
                | Target::Updater
                | Target::App
                | Target::Protocol => false,
            },
            JobType::Run { .. } => false,
        }
    }

    /// Provide the command that should be used in to build the target
    pub fn build_cmd(self, prod: bool) -> anyhow::Result<ProcessCommand> {
        let build_cmd = match self {
            Target::Binding => binding::get_build_cmd(prod)?,
            Target::Wasm => wasm::get_build_cmd(prod),
            Target::Protocol => protocol::get_build_cmd(prod),
            Target::Updater => updater::get_build_cmd(),
            rest_targets => rest_targets.kind().build_cmd(prod),
        };

        Ok(build_cmd)
    }

    /// Installs the needed module to perform the development task
    ///
    /// * `prod`: run install in production
    /// * `skip`: skip the task
    /// * `overridden_job_type`: override job type to communicate with tracker when install is ran
    ///   from within another task or when the production flag must be ignored
    pub async fn install(
        &self,
        prod: bool,
        skip: bool,
        overridden_job_type: Option<JobType>,
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

        let job_type = overridden_job_type.unwrap_or(JobType::Install { production: prod });

        match self {
            // We must install ts binding tools before running rs bindings, therefore we call
            // wrapper (ts-bindings) install in the rs bindings install.
            // Since rs bindings is a dependency for ts bindings, we don't need to call to install
            // on ts bindings again.
            Target::Binding => {
                install_general(Target::Wrapper, prod, job_type, Some(Target::Binding)).await
            }
            Target::Wrapper => None,
            // For app we don't need --production
            Target::App => install_general(Target::App, false, job_type, None).await,
            rest_targets => install_general(*rest_targets, prod, job_type, None).await,
        }
    }

    /// Run tests for the giving the target
    pub async fn test(
        &self,
        production: bool,
        skip: bool,
    ) -> Option<Result<SpawnResult, anyhow::Error>> {
        match self {
            Target::Wrapper => Some(wrapper::run_test(production, skip).await),
            rest_targets => rest_targets.run_test_general(production, skip).await,
        }
    }

    /// Provides the test commands for the given target if available
    fn test_cmds(self, production: bool) -> Option<Vec<TestSpawnCommand>> {
        match self {
            Target::Core | Target::CliDev | Target::CliChipmunk => {
                Some(rust_test_commands(self.cwd(), production))
            }
            Target::Wasm => Some(wasm::get_test_cmds()),
            Target::Shared
            | Target::Binding
            | Target::Wrapper
            | Target::Client
            | Target::Updater
            | Target::Protocol
            | Target::App => None,
        }
    }

    /// run test using the general routine with `test_cmds()` method
    async fn run_test_general(
        &self,
        production: bool,
        skip: bool,
    ) -> Option<Result<SpawnResult, anyhow::Error>> {
        let test_cmds = self.test_cmds(production)?;

        debug_assert!(!test_cmds.is_empty());

        let job_def = JobDefinition::new(*self, JobType::Test { production });

        // Environment value to set with for snapshot testing using `isnta` crate.
        let insta_env = if JobsState::get().accept_snapshots() {
            // This value will overwrite all changes on snapshots.
            "always"
        } else {
            // This will show the changes without writing any temporary file (with format
            // `*.snap.new`)
            "no"
        };
        let spawn_results = if skip {
            join_all(
                test_cmds
                    .into_iter()
                    .map(|cmd| spawn_skip(job_def, cmd.command.to_string())),
            )
            .await
        } else {
            join_all(test_cmds.into_iter().map(|cmd| {
                spawn(
                    job_def,
                    cmd.command,
                    Some(cmd.cwd),
                    [(String::from("INSTA_UPDATE"), String::from(insta_env))],
                    cmd.spawn_opts,
                )
            }))
            .await
        };

        let mut spawn_results = spawn_results.into_iter();

        let mut result = match spawn_results.next()? {
            Ok(result) => result,
            Err(err) => return Some(Err(err)),
        };

        for next_result in spawn_results {
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
        let job_def = JobDefinition::new(*self, JobType::Lint);

        let command = yarn_command(vec![String::from("run"), String::from("lint")]);
        spawn(job_def, command, Some(path), iter::empty(), None).await
    }

    /// Runs Clippy for the given rust target
    async fn clippy(&self) -> Result<SpawnResult, anyhow::Error> {
        let path = get_root().join(self.cwd());

        let job_def = JobDefinition::new(*self, JobType::Lint);

        let command = ProcessCommand::new(
            DevTool::Cargo.cmd(),
            vec![
                String::from("clippy"),
                String::from("--color"),
                String::from("always"),
                String::from("--all"),
                String::from("--all-features"),
                String::from("--"),
                String::from("-D"),
                String::from("warnings"),
            ],
        );

        spawn(job_def, command, Some(path), iter::empty(), None).await
    }

    /// Clean the given target, removing it from the checksum tracker as well.
    pub async fn reset(&self) -> anyhow::Result<SpawnResult> {
        let job_def = JobDefinition::new(*self, JobType::Clean);

        {
            // Clean doesn't differentiate between development and production, and both of them will be
            // cleaned from the files when the data are persisted.
            let mut checksum = BuildStateRecords::get(false)?.lock().map_err(|err| {
                anyhow::anyhow!("Error while acquiring items jobs mutex: Error {err}")
            })?;
            checksum.remove_state_if_exist(*self)?;
        }

        let mut paths_to_remove = vec![self.cwd().join("dist")];
        let path = match self.kind() {
            TargetKind::Ts => self.cwd().join("node_modules"),
            TargetKind::Rs => self.cwd().join("target"),
        };
        paths_to_remove.push(path);

        let tracker = get_tracker();

        match self {
            Target::Wasm => {
                paths_to_remove.push(self.cwd().join("pkg"));
                paths_to_remove.push(self.cwd().join("test_output"));
                paths_to_remove.push(self.cwd().join("node_modules"));
            }
            Target::Protocol => {
                paths_to_remove.push(self.cwd().join("pkg"));
            }
            Target::Wrapper => {
                paths_to_remove.push(self.cwd().join("spec").join("build"));
                let index_node_path = self.cwd().join("src").join("native").join("index.node");
                if index_node_path.exists() {
                    tracker.msg(
                        job_def,
                        format!("removing file: {}", index_node_path.display()),
                    );
                    fs::remove_file(index_node_path).await?;
                }
            }
            Target::Core
            | Target::Shared
            | Target::Binding
            | Target::Client
            | Target::Updater
            | Target::App
            | Target::CliDev
            | Target::CliChipmunk => {}
        }

        for path in paths_to_remove.into_iter().filter(|p| p.exists()) {
            let remove_log = format!("removing directory {}", path.display());
            tracker.msg(job_def, remove_log);

            fstools::rm_folder(job_def, &path)?;
        }

        let job = format!("Clean {}", self);

        let logs = tracker.get_logs(job_def).await?.unwrap_or_default();

        Ok(SpawnResult::create_for_fs(job, logs))
    }

    /// Runs build considering the currently running builds and already finished ones as well.
    pub async fn build(&self, prod: bool, skip: bool) -> Result<SpawnResult, anyhow::Error> {
        let path = get_root().join(self.cwd());
        let cmd = self.build_cmd(prod)?;

        let job_def = JobDefinition::new(*self, JobType::Build { production: prod });

        if skip {
            spawn_skip(job_def, cmd.to_string()).await
        } else {
            spawn(job_def, cmd, Some(path), iter::empty(), None).await
        }
    }

    /// Performs any needed copy operation after the build is done
    pub async fn after_build(
        &self,
        prod: bool,
        skip: bool,
    ) -> Option<Result<SpawnResult, anyhow::Error>> {
        let job_type = JobType::AfterBuild { production: prod };
        let job_def = JobDefinition::new(*self, job_type);

        if skip {
            return Some(spawn_skip(job_def, "Multiple file system commands".into()).await);
        }

        // Taken from a discussion on GitHub:
        // To build an npm package you would need (in most cases) to be in dev-mode - install dev-dependencies + dependencies,
        // therefore we always install in development mode at first.
        // But to prepare a package for production, you have to remove dev-dependencies.
        // That's not an issue, if npm-package is published in npmjs; but we are coping packages manually in a right destination
        // and before copy it, we have to reinstall it to get rid of dev-dependencies.
        let reinstall_res =
            if JobsState::get().is_release_build() && prod && matches!(self.kind(), TargetKind::Ts)
            {
                let node_path = self.cwd().join("node_modules");
                let remove_log = format!("removing directory {}", node_path.display());

                if let Err(err) = fstools::rm_folder(job_def, &node_path) {
                    return Some(Err(err));
                }

                match self.install(true, false, Some(job_type)).await {
                    Some(Ok(mut spawn_res)) => {
                        spawn_res.report.insert(0, remove_log);

                        // Return early if the reinstall command fails
                        if !spawn_res.status.success() {
                            return Some(Ok(spawn_res));
                        }

                        Some(spawn_res)
                    }
                    Some(Err(err)) => return Some(Err(err)),
                    None => None,
                }
            } else {
                None
            };

        let after_res = match self {
            Target::Binding => binding::copy_index_node(job_def).await,
            Target::Client => client::copy_client_to_app(job_def).await,
            Target::App => app::copy_package_file_to_dist(job_def).await,
            Target::Core
            | Target::Shared
            | Target::Wrapper
            | Target::Wasm
            | Target::Updater
            | Target::Protocol
            | Target::CliDev
            | Target::CliChipmunk => return None,
        };

        match (after_res, reinstall_res) {
            (res, None) => Some(res),
            (Err(err), _) => Some(Err(err)),
            (Ok(after_res), Some(mut install_res)) => {
                install_res.append(after_res);
                Some(Ok(install_res))
            }
        }
    }
}

/// run install using the general routine for the given target
/// * `target`: job target to perform its after build jobs
/// * `prod`: build for production
/// * `job_type`: job type to communicate with `tracker`
/// * `overridden_target`: override target to communicate with `tracker` when install is called
///   from within another task.
async fn install_general(
    target: Target,
    prod: bool,
    job_type: JobType,
    overridden_target: Option<Target>,
) -> Option<Result<SpawnResult, anyhow::Error>> {
    let cmd = match target {
        // Wasm needs `yarn install` command despite having the kind `TargetKind::Rs`
        Target::Wasm => TargetKind::Ts.install_cmd(prod),
        t => t.kind().install_cmd(prod),
    };

    let job_def = JobDefinition::new(overridden_target.unwrap_or(target), job_type);

    if let Some(cmd) = cmd {
        let res = spawn(job_def, cmd, Some(target.cwd()), iter::empty(), None).await;
        Some(res)
    } else {
        None
    }
}

/// Provides a process command with yarn as [`ProcessCommand::cmd`] and the given arguments
/// as [`ProcessCommand::args`]
fn yarn_command(args: Vec<String>) -> ProcessCommand {
    ProcessCommand::new(DevTool::Yarn.cmd(), args)
}

/// Provides the general commands to run tests on rust targets.
fn rust_test_commands(path: PathBuf, production: bool) -> Vec<TestSpawnCommand> {
    let mut args = vec![String::from("+stable"), String::from("test")];
    if production {
        args.push("-r".into());
    }
    args.push("--color".into());
    args.push("always".into());

    let cmd = ProcessCommand::new(DevTool::Cargo.cmd(), args);

    vec![TestSpawnCommand::new(cmd, path, None)]
}
