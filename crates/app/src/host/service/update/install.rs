//! Install-on-exit workflow for downloaded built-in app updates.

use std::path::PathBuf;

use thiserror::Error;

use crate::host::ui::update::{DownloadedUpdate, UpdateWorkflow};

use super::platform::{self, InstallerError};

/// Failure while installing a downloaded built-in app update.
#[derive(Debug, Error)]
pub enum InstallUpdateError {
    /// The downloaded artifact is missing before install-on-exit work.
    #[error("downloaded update artifact does not exist: {0}")]
    MissingArtifact(PathBuf),
    /// The downloaded artifact path could not be checked.
    #[error("failed to check downloaded update artifact '{path}'")]
    CheckArtifact {
        /// Staged artifact path.
        path: PathBuf,
        /// Filesystem check failure.
        #[source]
        source: std::io::Error,
    },
    /// The platform installer/package command could not be launched.
    #[error(transparent)]
    Installer(#[from] InstallerError),
    /// Archive replacement could not install the downloaded update.
    #[error("failed to install archive update: {source}")]
    Archive {
        /// Archive replacement failure.
        #[source]
        source: anyhow::Error,
    },
}

/// Runs the install-on-exit workflow for a downloaded update.
///
/// # Note:
///
/// This command may block the current thread.
pub fn launch(downloaded_update: &DownloadedUpdate) -> Result<(), InstallUpdateError> {
    let artifact_path = &downloaded_update.artifact_path;
    match artifact_path.try_exists() {
        Ok(true) => {}
        Ok(false) => return Err(InstallUpdateError::MissingArtifact(artifact_path.clone())),
        Err(source) => {
            return Err(InstallUpdateError::CheckArtifact {
                path: artifact_path.clone(),
                source,
            });
        }
    }

    match &downloaded_update.plan.workflow {
        UpdateWorkflow::Archive { install_dir } => {
            platform::replace_archive(artifact_path, install_dir)
                .map_err(|source| InstallUpdateError::Archive { source })
        }
        UpdateWorkflow::Deb => platform::linux::install_deb(artifact_path).map_err(Into::into),
        UpdateWorkflow::Rpm => platform::linux::install_rpm(artifact_path).map_err(Into::into),
        UpdateWorkflow::Msi => platform::windows::install_msi(artifact_path).map_err(Into::into),
        UpdateWorkflow::Pkg => platform::macos::install_pkg(artifact_path).map_err(Into::into),
    }
}
