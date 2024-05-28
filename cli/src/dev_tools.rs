use anyhow::{anyhow, Result};
use std::{fmt::Display, path::PathBuf};

use tokio::sync::OnceCell;
use which::{which_all_global, which_global};

#[derive(Debug, Clone, Copy)]
/// Represents the development tools which used to build & test the app
pub enum DevTool {
    Node,
    Npm,
    Yarn,
    RustUp,
    Cargo,
    WasmPack,
    NjCli,
}

impl Display for DevTool {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            DevTool::Node => write!(f, "NodeJS"),
            DevTool::Npm => write!(f, "npm"),
            DevTool::Yarn => write!(f, "yarn"),
            DevTool::RustUp => write!(f, "Rust"),
            DevTool::Cargo => write!(f, "cargo"),
            DevTool::WasmPack => write!(f, "wasm-pack"),
            DevTool::NjCli => write!(f, "nj-cl"),
        }
    }
}

impl DevTool {
    pub fn all() -> &'static [DevTool] {
        if cfg!(debug_assertions) {
            // This check to remember to add the newly added enums to this function
            match DevTool::Node {
                DevTool::Node => (),
                DevTool::Npm => (),
                DevTool::Yarn => (),
                DevTool::RustUp => (),
                DevTool::Cargo => (),
                DevTool::WasmPack => (),
                DevTool::NjCli => (),
            };
        }

        [
            DevTool::Node,
            DevTool::Npm,
            DevTool::Yarn,
            DevTool::RustUp,
            DevTool::Cargo,
            DevTool::WasmPack,
            DevTool::NjCli,
        ]
        .as_slice()
    }

    /// Provide the suggested way to install the tool
    pub fn install_hint(&self) -> Option<&'static str> {
        match self {
            DevTool::Node | DevTool::Npm | DevTool::RustUp | DevTool::Cargo => None,
            DevTool::Yarn => Some("npm install --global yarn"),
            DevTool::WasmPack => Some("cargo install wasm-pack"),
            DevTool::NjCli => Some("cargo install nj-cli"),
        }
    }

    /// Provide the command line argument to get the version of the installed tool
    pub fn version_args(&self) -> &'static str {
        match self {
            DevTool::Node | DevTool::Npm | DevTool::Yarn => "-v",
            DevTool::RustUp | DevTool::Cargo | DevTool::WasmPack | DevTool::NjCli => "-V",
        }
    }

    /// Resolve the path of the tool if exists. Returning an Error when not possible
    pub async fn resolve(&self) -> &'static Result<PathBuf> {
        match self {
            DevTool::Node => resolve_node().await,
            DevTool::Npm => resolve_npm().await,
            DevTool::Yarn => resolve_yarn().await,
            DevTool::RustUp => resolve_rustup().await,
            DevTool::Cargo => resolve_cargo().await,
            DevTool::WasmPack => resolve_wasm_pack().await,
            DevTool::NjCli => resolve_nj_cli().await,
        }
    }

    /// Get the path of the resolved tool. Panics if the tool can't be resolved   
    pub async fn path(&self) -> &'static PathBuf {
        self.resolve()
            .await
            .as_ref()
            .expect("Developer Error: Cmd has already been resolved")
    }
}

async fn resolve_node() -> &'static Result<PathBuf> {
    static NODE: OnceCell<Result<PathBuf>> = OnceCell::const_new();

    NODE.get_or_init(|| async { find_cmd("node") }).await
}

fn find_cmd(cmd: &str) -> Result<PathBuf> {
    which_global(cmd).map_err(|err| anyhow!("Command `{cmd}` couldn't be resolved. Err: {err}"))
}

async fn resolve_npm() -> &'static Result<PathBuf> {
    static NPM: OnceCell<Result<PathBuf>> = OnceCell::const_new();

    NPM.get_or_init(|| async { find_cmd("npm") }).await
}

async fn resolve_yarn() -> &'static Result<PathBuf> {
    static YARN: OnceCell<Result<PathBuf>> = OnceCell::const_new();

    YARN.get_or_init(|| async { find_cmd("yarn") }).await
}

async fn resolve_rustup() -> &'static Result<PathBuf> {
    static RUSTUP: OnceCell<Result<PathBuf>> = OnceCell::const_new();

    RUSTUP.get_or_init(|| async { find_cmd("rustup") }).await
}

async fn resolve_cargo() -> &'static Result<PathBuf> {
    static CARGO: OnceCell<Result<PathBuf>> = OnceCell::const_new();

    if cfg!(windows) {
        // Rust adds its toolchain to PATH in windows which must be filtered out
        CARGO
            .get_or_init(|| async {
                let mut paths = which_all_global("cargo")?;

                paths
                    .find(|p| p.components().any(|c| c.as_os_str() == ".cargo"))
                    .ok_or_else(|| anyhow!("The command 'cargo' can't be found"))
            })
            .await
    } else {
        CARGO.get_or_init(|| async { find_cmd("cargo") }).await
    }
}

async fn resolve_wasm_pack() -> &'static Result<PathBuf> {
    static WASM_PACK: OnceCell<Result<PathBuf>> = OnceCell::const_new();

    WASM_PACK
        .get_or_init(|| async { find_cmd("wasm-pack") })
        .await
}

async fn resolve_nj_cli() -> &'static Result<PathBuf> {
    static NJ_CLI: OnceCell<Result<PathBuf>> = OnceCell::const_new();

    NJ_CLI.get_or_init(|| async { find_cmd("nj-cli") }).await
}
