//! Manages the Loading and providing the minimal required version for the development tools
//! used in Chipmunk.

use anyhow::Context;
use serde::Deserialize;

use crate::{dev_tools::DevTool, location::global_configs_path, version::Version};

/// Filename of minimum required versions of development tools.
const MIN_VERSIONS_FILENAME: &str = "min_versions.toml";

#[derive(Debug, Clone, Deserialize)]
/// Represents the minimum versions required for the development of Chipmunk
pub struct MinVersions {
    cargo: Version,
    node: Version,
    npm: Version,
    yarn: Version,
    wasm_pack: Version,
    nj_cli: Version,
}

impl MinVersions {
    /// Loads the minimum required versions from their configuration files within
    /// Chipmunk repository.
    pub fn load() -> anyhow::Result<Self> {
        let min_versions_path = global_configs_path().join(MIN_VERSIONS_FILENAME);
        let file_content = std::fs::read_to_string(&min_versions_path).with_context(|| {
            format!(
                "Reading min versions file content failed. Path: {}",
                min_versions_path.display()
            )
        })?;
        toml::from_str(&file_content).with_context(|| {
            format!(
                "Desrializing min versions text failed. File Path: {}",
                min_versions_path.display(),
            )
        })
    }

    /// Provides the minimum required version for the provided development tool
    /// when configured.
    pub fn get_version(&self, tool: DevTool) -> Option<&Version> {
        match tool {
            DevTool::Node => Some(&self.node),
            DevTool::Npm => Some(&self.npm),
            DevTool::Yarn => Some(&self.yarn),
            DevTool::Cargo => Some(&self.cargo),
            DevTool::WasmPack => Some(&self.wasm_pack),
            DevTool::NjCli => Some(&self.nj_cli),
        }
    }
}
