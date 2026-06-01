//! Platform artifact naming and install detection for built-in app updates.

use std::{
    env::current_exe,
    ffi::OsStr,
    fs,
    io::ErrorKind,
    path::{Path, PathBuf},
    process::{Command as StdCommand, ExitStatus, Stdio},
    thread::sleep,
    time::{Duration, Instant},
};

use anyhow::{Context, bail};
use semver::Version;
use thiserror::Error;
use tokio::process::Command;
use uuid::Uuid;

use crate::host::ui::update::{UpdateArtifact, UpdateWorkflow};

use super::github::GithubAsset;

pub mod linux;
pub mod macos;
pub mod windows;

/// CPU architecture for release artifact naming.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TargetArch {
    /// x86_64 target architecture.
    X86_64,
    /// AArch64 target architecture.
    Aarch64,
}

/// Update workflow selection failure.
#[derive(Debug, Error)]
pub enum UpdateWorkflowErr {
    /// Current platform is not supported by the built-in updater.
    #[error("unsupported platform")]
    UnsupportedPlatform,
    /// The current executable path could not be resolved.
    #[error("current executable path is unavailable")]
    CurrentExeUnavailable,
    /// The installation path could not be resolved from the executable path.
    #[error("install path is unavailable")]
    InstallPathUnavailable,
    /// The shell used for platform detection could not be started.
    #[error("failed to run install detection command")]
    DetectionCommandFailed,
    /// Archive replacement target is not writable enough for automatic update.
    #[error("archive target is not writable: {0}")]
    ArchiveNotWritable(PathBuf),
}

/// Failure while preparing or launching a platform update installer/package.
#[derive(Debug, Error)]
pub enum InstallerError {
    /// The platform installer/package handoff could not be spawned.
    #[error("failed to launch update installer '{program}'")]
    Launch {
        /// Program used for installer/package handoff.
        program: &'static str,
        /// Process spawn failure.
        #[source]
        source: std::io::Error,
    },
    /// The installer/package handoff process exited with failure before shutdown continued.
    #[error("update installer '{program}' exited early with status {status}")]
    EarlyExit {
        /// Program used for installer/package handoff.
        program: &'static str,
        /// Early process exit status.
        status: ExitStatus,
    },
}

/// Detects the safe update workflow for the current installation.
pub async fn detect_install_workflow() -> Result<UpdateWorkflow, UpdateWorkflowErr> {
    let exe = current_exe().map_err(|_| UpdateWorkflowErr::CurrentExeUnavailable)?;

    detect_install_workflow_for(&exe).await
}

/// Returns the canonical executable path for the running process.
fn current_executable_target() -> anyhow::Result<PathBuf> {
    let exe = current_exe().context("current executable path is unavailable")?;
    fs::canonicalize(&exe).with_context(|| {
        format!(
            "failed to resolve current executable target '{}'",
            exe.display()
        )
    })
}

/// Replaces the current portable installation from a downloaded archive.
pub fn replace_archive(archive_path: &Path, install_dir: &Path) -> anyhow::Result<()> {
    if cfg!(target_os = "linux") {
        linux::replace_archive(archive_path, install_dir)
    } else if cfg!(target_os = "macos") {
        macos::replace_archive(archive_path, install_dir)
    } else if cfg!(target_os = "windows") {
        windows::replace_archive(archive_path, install_dir)
    } else {
        bail!("archive replacement is not supported on this platform")
    }
}

/// Builds a unique temporary replacement path next to the target executable.
fn replacement_temp_path(target_parent: &Path, target: &Path) -> PathBuf {
    let target_name = target
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("chipmunk");
    // Use a unique name so concurrent update attempts do not share a replacement file.
    target_parent.join(format!("{target_name}.update-{}.tmp", Uuid::new_v4()))
}

/// Removes a temporary replacement file and logs non-missing cleanup failures.
fn remove_temp_file(path: &Path) {
    if let Err(err) = fs::remove_file(path)
        && err.kind() != ErrorKind::NotFound
    {
        log::warn!(
            "Failed to remove temporary update file '{}': {err:#}",
            path.display()
        );
    }
}

/// Removes a temporary replacement directory and logs non-missing cleanup failures.
fn remove_temp_dir(path: &Path) {
    if let Err(err) = fs::remove_dir_all(path)
        && err.kind() != ErrorKind::NotFound
    {
        log::warn!(
            "Failed to remove temporary update directory '{}': {err:#}",
            path.display()
        );
    }
}

async fn detect_install_workflow_for(exe: &Path) -> Result<UpdateWorkflow, UpdateWorkflowErr> {
    if cfg!(target_os = "linux") {
        linux::detect_install_workflow(exe).await
    } else if cfg!(target_os = "windows") {
        windows::detect_install_workflow(exe).await
    } else if cfg!(target_os = "macos") {
        macos::detect_install_workflow(exe).await
    } else {
        Err(UpdateWorkflowErr::UnsupportedPlatform)
    }
}

/// Returns the reported executable path and its canonical target when it differs.
pub fn executable_paths(exe: PathBuf) -> Vec<PathBuf> {
    if let Ok(canonical) = fs::canonicalize(&exe)
        && canonical != exe
    {
        return vec![exe, canonical];
    }

    vec![exe]
}

/// Returns the directory that contains the executable selected for archive replacement.
pub fn archive_install_dir(exe: &Path) -> Result<PathBuf, UpdateWorkflowErr> {
    let target = fs::canonicalize(exe).unwrap_or_else(|_| exe.to_path_buf());

    target
        .parent()
        .map(Path::to_path_buf)
        .ok_or(UpdateWorkflowErr::InstallPathUnavailable)
}

/// Returns whether the directory metadata allows writing by this process.
pub fn is_writable_dir(path: &Path) -> bool {
    // Startup detection uses metadata only because it runs every launch,
    // so it doesn't make sense to try to create prop file as Real filesystem
    // failures are handled by archive replacement on close.
    fs::metadata(path).is_ok_and(|metadata| metadata.is_dir() && !metadata.permissions().readonly())
}

/// Selects the archive workflow when the installation directory is writable.
pub fn select_archive_workflow(install_dir: PathBuf) -> Result<UpdateWorkflow, UpdateWorkflowErr> {
    if is_writable_dir(&install_dir) {
        Ok(UpdateWorkflow::Archive { install_dir })
    } else {
        Err(UpdateWorkflowErr::ArchiveNotWritable(install_dir))
    }
}

/// Spawns an installer/package handoff command without waiting for it to finish.
pub fn spawn_installer_command<I, S>(program: &'static str, args: I) -> Result<(), InstallerError>
where
    I: IntoIterator<Item = S>,
    S: AsRef<OsStr>,
{
    let mut child = StdCommand::new(program)
        .args(args)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|source| InstallerError::Launch { program, source })?;

    // Check for installer commands early returns.

    let check_timeout = Duration::from_secs(1);
    let check_interval = Duration::from_millis(200);
    let deadline = Instant::now() + check_timeout;

    loop {
        match child.try_wait() {
            Ok(Some(status)) => {
                return if status.success() {
                    Ok(())
                } else {
                    Err(InstallerError::EarlyExit { program, status })
                };
            }
            Ok(None) => {}
            Err(err) => {
                log::warn!("Failed to check update installer process status: {err:#}");
                return Ok(());
            }
        }

        let now = Instant::now();
        if now >= deadline {
            return Ok(());
        }

        sleep(check_interval.min(deadline - now));
    }
}

/// Runs a shell detection command and returns whether it exited successfully.
pub async fn command_success(command: &str) -> Result<bool, UpdateWorkflowErr> {
    let output = Command::new("sh")
        .arg("-c")
        .arg(command)
        .output()
        .await
        .map_err(|_| UpdateWorkflowErr::DetectionCommandFailed)?;

    Ok(output.status.success())
}

/// Returns the release artifact matching the selected update workflow.
pub fn matching_artifact(
    version: &Version,
    workflow: &UpdateWorkflow,
    assets: &[GithubAsset],
) -> Option<UpdateArtifact> {
    let expected_name = current_artifact_name(version, workflow)?;
    find_artifact(&expected_name, assets)
}

fn current_artifact_name(version: &Version, workflow: &UpdateWorkflow) -> Option<String> {
    let arch = current_arch()?;

    if cfg!(target_os = "linux") {
        linux::artifact_name(version, arch, workflow)
    } else if cfg!(target_os = "macos") {
        macos::artifact_name(version, arch, workflow)
    } else if cfg!(target_os = "windows") {
        windows::artifact_name(version, arch, workflow)
    } else {
        None
    }
}

fn current_arch() -> Option<TargetArch> {
    if cfg!(target_arch = "x86_64") {
        Some(TargetArch::X86_64)
    } else if cfg!(target_arch = "aarch64") {
        Some(TargetArch::Aarch64)
    } else {
        None
    }
}

fn find_artifact(expected_name: &str, assets: &[GithubAsset]) -> Option<UpdateArtifact> {
    let asset = assets.iter().find(|asset| asset.name == expected_name)?;

    let artifact = UpdateArtifact {
        name: asset.name.clone(),
        download_url: asset.browser_download_url.clone(),
    };

    Some(artifact)
}

fn release_asset_name(version: &Version, platform: &str, suffix: &str) -> String {
    format!("chipmunk@{version}-{platform}{suffix}")
}

#[cfg(test)]
mod tests {
    use std::fs::{File, canonicalize};

    #[cfg(unix)]
    use std::os::unix::fs::symlink;

    use tempfile::tempdir;

    use super::*;

    fn asset(name: &str) -> GithubAsset {
        GithubAsset {
            name: name.into(),
            browser_download_url: format!("https://example.com/{name}"),
        }
    }

    #[cfg(unix)]
    #[test]
    fn executable_paths_include_canonical_symlink_target() {
        let dir = tempdir().unwrap();
        let target = dir.path().join("chipmunk-real");
        let link = dir.path().join("chipmunk");
        File::create(&target).unwrap();
        symlink(&target, &link).unwrap();

        let paths = executable_paths(link.clone());

        assert_eq!(paths, vec![link.clone(), canonicalize(&target).unwrap()]);
    }

    #[test]
    fn find_artifact_matches_exact_name() {
        let expected_name = "chipmunk@4.0.0-linux-portable.tgz";
        let assets = vec![
            asset("chipmunk@4.0.0-linux-portable.tgz.sha256"),
            asset("chipmunk@4.0.0-linux-portable.tgz"),
        ];

        let artifact = find_artifact(expected_name, &assets).unwrap();

        assert_eq!(artifact.name, "chipmunk@4.0.0-linux-portable.tgz");
        assert_eq!(
            artifact.download_url,
            "https://example.com/chipmunk@4.0.0-linux-portable.tgz"
        );
    }

    #[test]
    fn find_artifact_returns_none_when_missing() {
        let expected_name = "chipmunk@4.0.0-linux-portable.tgz";
        let assets = vec![asset("chipmunk@4.0.0-darwin.pkg")];

        assert_eq!(find_artifact(expected_name, &assets), None);
    }

    #[cfg(all(target_os = "linux", target_arch = "x86_64"))]
    #[test]
    fn matching_artifact_uses_selected_linux_workflow_without_fallback() {
        let assets = vec![
            asset("chipmunk@4.0.0-linux-portable.tgz"),
            asset("chipmunk@4.0.0-linux-amd64.deb"),
        ];

        let version = Version::parse("4.0.0").unwrap();
        let deb = matching_artifact(&version, &UpdateWorkflow::Deb, &assets).unwrap();
        assert_eq!(deb.name, "chipmunk@4.0.0-linux-amd64.deb");

        assert_eq!(
            matching_artifact(&version, &UpdateWorkflow::Rpm, &assets),
            None
        );
    }
}
