use crate::{modules, modules::Manager};
use clap::ValueEnum;

#[derive(ValueEnum, Clone, Debug, Hash, PartialEq, Eq)]
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

impl Target {
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
}
