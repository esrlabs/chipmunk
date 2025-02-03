//! Manages finding and resolving the paths of the installed development tools on different
//! platforms.

use std::fmt::Display;

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
    pub fn install_hint(self) -> Option<&'static str> {
        match self {
            DevTool::Node | DevTool::Npm | DevTool::RustUp | DevTool::Cargo => None,
            DevTool::Yarn => Some("npm install --global yarn"),
            DevTool::WasmPack => Some("cargo install wasm-pack"),
            DevTool::NjCli => Some("cargo install nj-cli"),
        }
    }

    /// Provides the command line command for the development tool.
    pub const fn cmd(self) -> &'static str {
        match self {
            DevTool::Node => "node",
            DevTool::Npm => "npm",
            DevTool::Yarn => "yarn",
            DevTool::RustUp => "rustup",
            DevTool::Cargo => "cargo",
            DevTool::WasmPack => "wasm-pack",
            DevTool::NjCli => "nj-cli",
        }
    }
}
