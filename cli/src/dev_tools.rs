use anyhow::{anyhow, Result};
use std::{fmt::Display, path::PathBuf, sync::OnceLock};

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
    /// Returns all needed tools to chipmunk development
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
    pub fn resolve(&self) -> &'static Result<PathBuf> {
        match self {
            DevTool::Node => resolve_node(),
            DevTool::Npm => resolve_npm(),
            DevTool::Yarn => resolve_yarn(),
            DevTool::RustUp => resolve_rustup(),
            DevTool::Cargo => resolve_cargo(),
            DevTool::WasmPack => resolve_wasm_pack(),
            DevTool::NjCli => resolve_nj_cli(),
        }
    }

    /// Get the path of the resolved tool. Panics if the tool can't be resolved   
    pub fn path(&self) -> &'static PathBuf {
        self.resolve()
            .as_ref()
            .expect("Developer Error: Cmd has already been resolved")
    }
}

fn resolve_node() -> &'static Result<PathBuf> {
    static NODE: OnceLock<Result<PathBuf>> = OnceLock::new();

    NODE.get_or_init(|| find_cmd("node"))
}

fn find_cmd(cmd: &str) -> Result<PathBuf> {
    which_global(cmd).map_err(|err| anyhow!("Command `{cmd}` couldn't be resolved. Err: {err}"))
}

fn resolve_npm() -> &'static Result<PathBuf> {
    static NPM: OnceLock<Result<PathBuf>> = OnceLock::new();

    NPM.get_or_init(|| find_cmd("npm"))
}

fn resolve_yarn() -> &'static Result<PathBuf> {
    static YARN: OnceLock<Result<PathBuf>> = OnceLock::new();

    YARN.get_or_init(|| find_cmd("yarn"))
}

fn resolve_rustup() -> &'static Result<PathBuf> {
    static RUSTUP: OnceLock<Result<PathBuf>> = OnceLock::new();

    RUSTUP.get_or_init(|| find_cmd("rustup"))
}

fn resolve_cargo() -> &'static Result<PathBuf> {
    static CARGO: OnceLock<Result<PathBuf>> = OnceLock::new();

    if cfg!(windows) {
        // Rust adds its toolchain to PATH in windows which must be filtered out
        CARGO.get_or_init(|| {
            let mut paths = which_all_global("cargo")?;

            paths
                .find(|p| p.components().any(|c| c.as_os_str() == ".cargo"))
                .ok_or_else(|| anyhow!("The command 'cargo' can't be found"))
        })
    } else {
        CARGO.get_or_init(|| find_cmd("cargo"))
    }
}

fn resolve_wasm_pack() -> &'static Result<PathBuf> {
    static WASM_PACK: OnceLock<Result<PathBuf>> = OnceLock::new();

    WASM_PACK.get_or_init(|| find_cmd("wasm-pack"))
}

fn resolve_nj_cli() -> &'static Result<PathBuf> {
    static NJ_CLI: OnceLock<Result<PathBuf>> = OnceLock::new();

    NJ_CLI.get_or_init(|| find_cmd("nj-cli"))
}
