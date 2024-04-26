use std::{iter, path::PathBuf, str::FromStr};

use crate::{
    location::get_root,
    modules::Manager,
    modules::{self},
    spawner::{spawn, SpawnResult},
};
use anyhow::bail;
use clap::ValueEnum;

//TODO AAZ: Conisder which module should be pub after teh refactoring is done
mod binding;
pub mod client;
mod target_kind;
mod wasm;

//TODO AAZ: Conisder removing this when refactoring is done
pub use target_kind::TargetKind;

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
            }
        )
    }
}

impl FromStr for Target {
    type Err = anyhow::Error;

    fn from_str(input: &str) -> Result<Self, Self::Err> {
        type T = Target;

        match input {
            "Core" => Ok(T::Core),
            "Wrapper" => Ok(T::Wrapper),
            "Binding" => Ok(T::Binding),
            "Cli" => Ok(T::Cli),
            "Client" => Ok(T::Client),
            "Shared" => Ok(T::Shared),
            "App" => Ok(T::App),
            "Wasm" => Ok(T::Wasm),
            invalid => bail!("Invalid input: {invalid}"),
        }
    }
}

impl Target {
    pub fn _all_enums() -> Vec<Target> {
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
            };
        }

        vec![
            Target::Core,
            Target::Binding,
            Target::Wrapper,
            Target::Client,
            Target::Shared,
            Target::App,
            Target::Cli,
            Target::Wasm,
        ]
    }

    //TODO AAZ: Replace this with _all_enums
    pub fn all() -> Vec<Box<dyn Manager + Sync + Send>> {
        vec![
            Box::new(modules::binding::Module::new()),
            Box::new(modules::cli::Module::new()),
            Box::new(modules::app::Module::new()),
            Box::new(modules::core::Module::new()),
            Box::new(modules::wrapper::Module::new()),
            Box::new(modules::shared::Module::new()),
            Box::new(modules::client::Module::new()),
            Box::new(modules::wasm::Module::new()),
        ]
    }
    //TODO AAZ: Remove this
    pub fn get(&self) -> Box<dyn Manager + Sync + Send> {
        match self {
            Target::Binding => Box::new(modules::binding::Module::new()),
            Target::Cli => Box::new(modules::cli::Module::new()),
            Target::Client => Box::new(modules::client::Module::new()),
            Target::Core => Box::new(modules::core::Module::new()),
            Target::Wrapper => Box::new(modules::wrapper::Module::new()),
            Target::Shared => Box::new(modules::shared::Module::new()),
            Target::App => Box::new(modules::app::Module::new()),
            Target::Wasm => Box::new(modules::wasm::Module::new()),
        }
    }

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
        };

        let sub_path: PathBuf = sub_parts.collect();

        root.join(sub_path)
    }

    pub fn kind(&self) -> TargetKind {
        match self {
            Target::Binding | Target::Core | Target::Cli | Target::Wasm => TargetKind::Rs,
            Target::Client | Target::Wrapper | Target::Shared | Target::App => TargetKind::Ts,
        }
    }

    pub fn deps(&self) -> Vec<Target> {
        match self {
            Target::Core | Target::Cli | Target::Shared | Target::Wasm => Vec::new(),
            Target::Binding => vec![Target::Shared],
            Target::Wrapper => vec![Target::Binding, Target::Shared],
            Target::Client => vec![Target::Shared, Target::Wasm],
            Target::App => vec![Target::Shared, Target::Wrapper, Target::Client],
        }
    }

    pub fn build_cmd(&self, prod: bool) -> String {
        match self {
            Target::Binding => binding::get_build_cmd(prod),
            Target::Wasm => wasm::get_build_cmd(prod),
            rest_targets => rest_targets.kind().build_cmd(prod),
        }
    }

    pub async fn install(&self, prod: bool) -> Result<SpawnResult, anyhow::Error> {
        match self {
            // We must install ts binding tools before running rs bindings, therefore we call
            // wrapper (ts-bindings) install in the rs bindings install.
            // TODO AAZ: Make sure the following statement is correct:
            // Since rs bindings is a dependency for ts bindings, we don't need to call to install
            // on ts bindings again.
            Target::Binding => install_general(&Target::Wrapper, prod).await,
            Target::Wrapper => Ok(SpawnResult::empty()),
            // For app we don't need --production
            Target::App => install_general(&Target::App, false).await,
            rest_targets => install_general(rest_targets, prod).await,
        }
    }
}
/// run install using the general routine for the given target
async fn install_general(target: &Target, prod: bool) -> Result<SpawnResult, anyhow::Error> {
    let cmd = target.kind().install_cmd(prod);
    if let Some(cmd) = cmd {
        let caption = format!("Install {}", target);
        spawn(cmd, Some(target.cwd()), caption, iter::empty(), None).await
    } else {
        Ok(SpawnResult::empty())
    }
}
