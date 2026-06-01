//! Linux update artifact contract and install detection.

use std::{
    fs,
    path::{Path, PathBuf},
};

use anyhow::{Context, bail, ensure};
use semver::Version;
use uuid::Uuid;

use super::super::archive;
use super::{
    InstallerError, TargetArch, UpdateWorkflow, UpdateWorkflowErr, archive_install_dir,
    command_success, current_executable_target, executable_paths, release_asset_name,
    remove_temp_file, replacement_temp_path, select_archive_workflow, spawn_installer_command,
};

/// Returns the Linux artifact name for a supported architecture and workflow.
pub fn artifact_name(
    version: &Version,
    arch: TargetArch,
    workflow: &UpdateWorkflow,
) -> Option<String> {
    match (arch, workflow) {
        (TargetArch::X86_64, UpdateWorkflow::Archive { .. }) => {
            Some(release_asset_name(version, "linux", "-portable.tgz"))
        }
        (TargetArch::X86_64, UpdateWorkflow::Deb) => {
            Some(release_asset_name(version, "linux", "-amd64.deb"))
        }
        (TargetArch::X86_64, UpdateWorkflow::Rpm) => {
            Some(release_asset_name(version, "linux", "-x86_64.rpm"))
        }
        (TargetArch::X86_64, UpdateWorkflow::Msi | UpdateWorkflow::Pkg)
        | (
            TargetArch::Aarch64,
            UpdateWorkflow::Archive { .. }
            | UpdateWorkflow::Deb
            | UpdateWorkflow::Rpm
            | UpdateWorkflow::Msi
            | UpdateWorkflow::Pkg,
        ) => None,
    }
}

/// Launches a Debian package through the desktop package handler.
pub fn install_deb(path: &Path) -> Result<(), InstallerError> {
    spawn_installer_command("xdg-open", [path.as_os_str()])
}

/// Launches an RPM package through the desktop package handler.
pub fn install_rpm(path: &Path) -> Result<(), InstallerError> {
    spawn_installer_command("xdg-open", [path.as_os_str()])
}

/// Replaces the current Linux executable from a portable update archive.
pub fn replace_archive(archive_path: &Path, install_dir: &Path) -> anyhow::Result<()> {
    let target = current_executable_target()?;
    replace_archive_for_target(archive_path, install_dir, &target)
}

fn replace_archive_for_target(
    archive_path: &Path,
    install_dir: &Path,
    target: &Path,
) -> anyhow::Result<()> {
    verify_install_dir(install_dir, target)?;

    let stage_dir = archive_stage_dir(archive_path);
    fs::create_dir_all(&stage_dir).with_context(|| {
        format!(
            "failed to prepare update archive extraction directory '{}'",
            stage_dir.display()
        )
    })?;
    archive::unpack_archive(archive_path, &stage_dir)
        .context("failed to unpack Linux update archive")?;

    let archive_executable = stage_dir.join("chipmunk");
    replace_executable_from_archive(&archive_executable, target)
}

/// Verifies the planned archive install directory still matches the canonical executable parent.
fn verify_install_dir(install_dir: &Path, target: &Path) -> anyhow::Result<()> {
    let target_parent = target.parent().with_context(|| {
        format!(
            "current executable target has no parent directory: {}",
            target.display()
        )
    })?;
    let target_parent = fs::canonicalize(target_parent).with_context(|| {
        format!(
            "failed to resolve current executable target parent '{}'",
            target_parent.display()
        )
    })?;
    let install_dir = fs::canonicalize(install_dir).with_context(|| {
        format!(
            "failed to resolve selected archive install directory '{}'",
            install_dir.display()
        )
    })?;

    ensure!(
        install_dir == target_parent,
        "archive install directory '{}' does not match the running executable target '{}'",
        install_dir.display(),
        target.display()
    );

    Ok(())
}

fn archive_stage_dir(archive_path: &Path) -> PathBuf {
    let parent = archive_path.parent().unwrap_or_else(|| Path::new("."));
    parent.join(format!("archive-stage-{}", Uuid::new_v4()))
}

fn replace_executable_from_archive(archive_executable: &Path, target: &Path) -> anyhow::Result<()> {
    // Validate the archive layout before touching the installed executable.
    let metadata = match fs::metadata(archive_executable) {
        Ok(metadata) => metadata,
        Err(source) if source.kind() == std::io::ErrorKind::NotFound => {
            bail!(
                "Linux update archive does not contain a root chipmunk executable: {}",
                archive_executable.display()
            );
        }
        Err(source) => {
            return Err(source).with_context(|| {
                format!(
                    "failed to read extracted executable metadata '{}'",
                    archive_executable.display()
                )
            });
        }
    };

    ensure!(
        metadata.is_file(),
        "Linux update archive root chipmunk entry is not a file: {}",
        archive_executable.display()
    );

    // Copy into the target directory first so the final rename stays local.
    let target_parent = target.parent().with_context(|| {
        format!(
            "current executable target has no parent directory: {}",
            target.display()
        )
    })?;
    let temp_path = replacement_temp_path(target_parent, target);

    fs::copy(archive_executable, &temp_path).map_err(|source| {
        remove_temp_file(&temp_path);
        anyhow::Error::new(source).context(format!(
            "failed to copy extracted executable from '{}' to '{}'",
            archive_executable.display(),
            temp_path.display()
        ))
    })?;

    // Swap the prepared executable into place only after all earlier steps succeeded.
    fs::rename(&temp_path, target).map_err(|source| {
        remove_temp_file(&temp_path);
        anyhow::Error::new(source).context(format!(
            "failed to replace current executable '{}'",
            target.display()
        ))
    })
}

/// Detects the Linux update workflow for the executable path.
pub async fn detect_install_workflow(exe: &Path) -> Result<UpdateWorkflow, UpdateWorkflowErr> {
    let paths = executable_paths(exe.to_path_buf());

    if check_deb_package(&paths).await? {
        return Ok(UpdateWorkflow::Deb);
    }

    if check_rpm_package(&paths).await? {
        return Ok(UpdateWorkflow::Rpm);
    }

    let install_dir = archive_install_dir(exe)?;
    select_archive_workflow(install_dir)
}

async fn check_deb_package(paths: &[PathBuf]) -> Result<bool, UpdateWorkflowErr> {
    for path in paths {
        let path = quote_shell_path(&path.to_string_lossy());
        let command = format!("dpkg-query -S {path}");
        if command_success(&command).await? {
            return Ok(true);
        }

        let command = format!("dpkg -S {path}");
        if command_success(&command).await? {
            return Ok(true);
        }
    }

    Ok(false)
}

async fn check_rpm_package(paths: &[PathBuf]) -> Result<bool, UpdateWorkflowErr> {
    for path in paths {
        let path = quote_shell_path(&path.to_string_lossy());
        let command = format!("rpm -qf {path}");
        if command_success(&command).await? {
            return Ok(true);
        }
    }

    Ok(false)
}

/// Quotes a path for insertion into the POSIX shell command passed to `sh -c`.
fn quote_shell_path(value: &str) -> String {
    // Example: /opt/Chipmunk's/bin -> '/opt/Chipmunk'\''s/bin'
    format!("'{}'", value.replace('\'', "'\\''"))
}

#[cfg(test)]
mod tests {
    use super::*;

    use std::fs::{self, File};

    use flate2::{Compression, write::GzEncoder};
    use tar::{Builder, Header};
    use tempfile::tempdir;

    fn version() -> Version {
        Version::parse("4.0.0").unwrap()
    }

    #[test]
    fn shell_quote_escapes_single_quotes() {
        let quoted = quote_shell_path("/opt/Chipmunk's/bin/chipmunk");

        assert_eq!(quoted, "'/opt/Chipmunk'\\''s/bin/chipmunk'");
    }

    #[test]
    fn x86_64_uses_portable_archive() {
        let workflow = UpdateWorkflow::Archive {
            install_dir: PathBuf::from("/opt/chipmunk"),
        };
        let artifact_name = artifact_name(&version(), TargetArch::X86_64, &workflow).unwrap();

        assert_eq!(artifact_name, "chipmunk@4.0.0-linux-portable.tgz");
    }

    #[test]
    fn x86_64_uses_deb_package() {
        let artifact_name =
            artifact_name(&version(), TargetArch::X86_64, &UpdateWorkflow::Deb).unwrap();

        assert_eq!(artifact_name, "chipmunk@4.0.0-linux-amd64.deb");
    }

    #[test]
    fn x86_64_uses_rpm_package() {
        let artifact_name =
            artifact_name(&version(), TargetArch::X86_64, &UpdateWorkflow::Rpm).unwrap();

        assert_eq!(artifact_name, "chipmunk@4.0.0-linux-x86_64.rpm");
    }

    #[test]
    fn aarch64_is_not_supported() {
        assert_eq!(
            artifact_name(&version(), TargetArch::Aarch64, &UpdateWorkflow::Deb),
            None
        );
    }

    #[test]
    fn archive_replacement_replaces_only_executable() {
        let dir = tempdir().unwrap();
        let target = dir.path().join("chipmunk-real");
        let readme = dir.path().join("README.md");
        write_file(&target, b"old");
        write_file(&readme, b"old readme");

        let archive_path = dir.path().join("update.tgz");
        write_tgz(
            &archive_path,
            &[
                ("chipmunk", b"new".as_slice()),
                ("README.md", b"new readme".as_slice()),
            ],
        );

        replace_archive_for_target(&archive_path, dir.path(), &target).unwrap();

        assert_eq!(fs::read(&target).unwrap(), b"new");
        assert_eq!(fs::read(&readme).unwrap(), b"old readme");
    }

    #[test]
    fn archive_replacement_requires_root_executable() {
        let dir = tempdir().unwrap();
        let target = dir.path().join("chipmunk");
        write_file(&target, b"old");

        let archive_path = dir.path().join("update.tgz");
        write_tgz(&archive_path, &[("README.md", b"readme".as_slice())]);

        assert!(replace_archive_for_target(&archive_path, dir.path(), &target).is_err());
        assert_eq!(fs::read(&target).unwrap(), b"old");
    }

    fn write_file(path: &Path, content: &[u8]) {
        fs::write(path, content).unwrap();
    }

    fn write_tgz(archive_path: &Path, entries: &[(&str, &[u8])]) {
        let archive = File::create(archive_path).unwrap();
        let encoder = GzEncoder::new(archive, Compression::default());
        let mut builder = Builder::new(encoder);

        for (path, content) in entries {
            let mut header = Header::new_gnu();
            header.set_size(content.len() as u64);
            header.set_cksum();
            builder.append_data(&mut header, path, *content).unwrap();
        }

        let encoder = builder.into_inner().unwrap();
        encoder.finish().unwrap();
    }
}
