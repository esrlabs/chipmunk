//! macOS update artifact contract and install detection.

use std::{
    fs,
    io::ErrorKind,
    path::{Path, PathBuf},
};

use anyhow::{Context, bail, ensure};
use semver::Version;
use uuid::Uuid;

use super::super::archive;
use super::{
    InstallerError, TargetArch, UpdateWorkflow, UpdateWorkflowErr, command_success,
    current_executable_target, executable_paths, release_asset_name, remove_temp_dir,
    select_archive_workflow, spawn_installer_command,
};

const DEFAULT_MAC_APP_BUNDLE: &str = "chipmunk.app";
const MAC_APP_EXECUTABLE: &str = "Contents/MacOS/chipmunk";

/// Returns the macOS artifact name for a supported architecture and workflow.
pub fn artifact_name(
    version: &Version,
    arch: TargetArch,
    workflow: &UpdateWorkflow,
) -> Option<String> {
    match (arch, workflow) {
        (TargetArch::X86_64, UpdateWorkflow::Archive { .. }) => {
            Some(release_asset_name(version, "darwin", "-portable.tgz"))
        }
        (TargetArch::Aarch64, UpdateWorkflow::Archive { .. }) => {
            Some(release_asset_name(version, "darwin-arm64", "-portable.tgz"))
        }
        (TargetArch::X86_64, UpdateWorkflow::Pkg) => {
            Some(release_asset_name(version, "darwin", ".pkg"))
        }
        (TargetArch::Aarch64, UpdateWorkflow::Pkg) => {
            Some(release_asset_name(version, "darwin-arm64", ".pkg"))
        }
        (
            TargetArch::X86_64 | TargetArch::Aarch64,
            UpdateWorkflow::Deb | UpdateWorkflow::Rpm | UpdateWorkflow::Msi,
        ) => None,
    }
}

/// Launches a PKG package through Installer.app.
pub fn install_pkg(path: &Path) -> Result<(), InstallerError> {
    spawn_installer_command("open", [path.as_os_str()])
}

/// Replaces the current macOS app bundle from a portable update archive.
pub fn replace_archive(archive_path: &Path, install_dir: &Path) -> anyhow::Result<()> {
    let target = current_executable_target()?;
    replace_archive_for_target(archive_path, install_dir, &target)
}

fn replace_archive_for_target(
    archive_path: &Path,
    install_dir: &Path,
    target: &Path,
) -> anyhow::Result<()> {
    // macOS portable updates replace the whole .app bundle, not just the Mach-O binary.
    let current_bundle = app_bundle_path(target).with_context(|| {
        format!(
            "current executable is not inside a macOS app bundle: {}",
            target.display()
        )
    })?;
    verify_install_dir(install_dir, &current_bundle)?;

    // Extract beside the installed bundle so the final rename stays on the same filesystem.
    let archive_extraction_dir = install_dir.join(format!("archive-stage-{}", Uuid::new_v4()));
    fs::create_dir_all(&archive_extraction_dir).with_context(|| {
        format!(
            "failed to prepare update archive extraction directory '{}'",
            archive_extraction_dir.display()
        )
    })?;
    let result = (|| {
        archive::unpack_archive(archive_path, &archive_extraction_dir)
            .context("failed to unpack macOS update archive")?;

        // Release archives always contain chipmunk.app at archive root.
        let archive_bundle = archive_extraction_dir.join(DEFAULT_MAC_APP_BUNDLE);
        copy_bundle_from_archive(&archive_bundle, &current_bundle)
    })();
    remove_temp_dir(&archive_extraction_dir);

    result
}

/// Detects the macOS update workflow for the executable path.
pub async fn detect_install_workflow(exe: &Path) -> Result<UpdateWorkflow, UpdateWorkflowErr> {
    let paths = executable_paths(exe.to_path_buf());
    let bundle = paths.iter().find_map(|path| app_bundle_path(path));

    if bundle
        .as_ref()
        .is_some_and(|bundle| is_chipmunk_app(bundle))
        && pkg_installed().await?
    {
        return Ok(UpdateWorkflow::Pkg);
    }

    // A renamed bundle is still safe for archive replacement, but not enough evidence for PKG.
    let Some(bundle) = bundle else {
        // macOS portable artifacts contain a full app bundle, not a flat executable.
        return Err(UpdateWorkflowErr::InstallPathUnavailable);
    };

    let install_dir = archive_install_dir_for_bundle(&bundle)?;
    select_archive_workflow(install_dir)
}

async fn pkg_installed() -> Result<bool, UpdateWorkflowErr> {
    command_success("pkgutil --pkg-info com.esrlabs.chipmunk").await
}

fn archive_install_dir_for_bundle(bundle: &Path) -> Result<PathBuf, UpdateWorkflowErr> {
    // Replacing Foo.app requires write access to the directory containing Foo.app.
    bundle
        .parent()
        .filter(|parent| !parent.as_os_str().is_empty())
        .map(Path::to_path_buf)
        .ok_or(UpdateWorkflowErr::InstallPathUnavailable)
}

fn app_bundle_path(exe: &Path) -> Option<PathBuf> {
    // A macOS app is a directory tree ending in .app. Finder launches the binary from:
    // Chipmunk.app/Contents/MacOS/chipmunk
    let macos_dir = exe.parent()?;
    if macos_dir.file_name()? != "MacOS" {
        return None;
    }

    let contents_dir = macos_dir.parent()?;
    if contents_dir.file_name()? != "Contents" {
        return None;
    }

    // The bundle itself is the .app directory above Contents.
    let bundle = contents_dir.parent()?;
    if bundle
        .file_name()?
        .to_string_lossy()
        .to_lowercase()
        .ends_with(".app")
    {
        Some(bundle.to_path_buf())
    } else {
        None
    }
}

fn is_chipmunk_app(bundle: &Path) -> bool {
    bundle
        .file_name()
        .is_some_and(|name| name.to_string_lossy().eq_ignore_ascii_case("Chipmunk.app"))
}

fn verify_install_dir(install_dir: &Path, current_bundle: &Path) -> anyhow::Result<()> {
    // The downloaded plan stores the bundle parent selected during update detection.
    // Re-check it at install time so a moved app cannot update the wrong directory.
    let bundle_parent = current_bundle.parent().with_context(|| {
        format!(
            "current app bundle has no parent directory: {}",
            current_bundle.display()
        )
    })?;
    let bundle_parent = fs::canonicalize(bundle_parent).with_context(|| {
        format!(
            "failed to resolve current app bundle parent '{}'",
            bundle_parent.display()
        )
    })?;
    let install_dir = fs::canonicalize(install_dir).with_context(|| {
        format!(
            "failed to resolve selected archive install directory '{}'",
            install_dir.display()
        )
    })?;

    ensure!(
        install_dir == bundle_parent,
        "archive install directory '{}' does not match the running app bundle '{}'",
        install_dir.display(),
        current_bundle.display()
    );

    Ok(())
}

fn copy_bundle_from_archive(archive_bundle: &Path, current_bundle: &Path) -> anyhow::Result<()> {
    validate_archive_bundle(archive_bundle)?;

    copy_dir_contents(archive_bundle, current_bundle).with_context(|| {
        format!(
            "failed to copy update app bundle '{}' over '{}'",
            archive_bundle.display(),
            current_bundle.display()
        )
    })
}

fn copy_dir_contents(source: &Path, destination: &Path) -> anyhow::Result<()> {
    fs::create_dir_all(destination).with_context(|| {
        format!(
            "failed to prepare destination directory '{}'",
            destination.display()
        )
    })?;

    for entry in fs::read_dir(source)
        .with_context(|| format!("failed to read source directory '{}'", source.display()))?
    {
        let entry = entry.with_context(|| {
            format!(
                "failed to read source directory entry in '{}'",
                source.display()
            )
        })?;
        let source_path = entry.path();
        let destination_path = destination.join(entry.file_name());
        let metadata = entry.metadata().with_context(|| {
            format!(
                "failed to read source entry metadata '{}'",
                source_path.display()
            )
        })?;

        if metadata.is_dir() {
            copy_dir_contents(&source_path, &destination_path)?;
        } else if metadata.is_file() {
            fs::copy(&source_path, &destination_path).with_context(|| {
                format!(
                    "failed to copy '{}' to '{}'",
                    source_path.display(),
                    destination_path.display()
                )
            })?;
        } else {
            bail!(
                "macOS update archive contains an unsupported bundle entry: {}",
                source_path.display()
            );
        }
    }

    Ok(())
}

fn validate_archive_bundle(archive_bundle: &Path) -> anyhow::Result<()> {
    // Keep validation minimal: the archive must contain an app bundle with the launch binary.
    let metadata = match fs::metadata(archive_bundle) {
        Ok(metadata) => metadata,
        Err(source) if source.kind() == ErrorKind::NotFound => {
            bail!(
                "macOS update archive does not contain a root chipmunk.app bundle: {}",
                archive_bundle.display()
            );
        }
        Err(source) => {
            return Err(source).with_context(|| {
                format!(
                    "failed to read extracted app bundle metadata '{}'",
                    archive_bundle.display()
                )
            });
        }
    };

    ensure!(
        metadata.is_dir(),
        "macOS update archive root chipmunk.app entry is not a directory: {}",
        archive_bundle.display()
    );

    let executable = archive_bundle.join(MAC_APP_EXECUTABLE);
    let metadata = match fs::metadata(&executable) {
        Ok(metadata) => metadata,
        Err(source) if source.kind() == ErrorKind::NotFound => {
            bail!(
                "macOS update archive does not contain the app executable: {}",
                executable.display()
            );
        }
        Err(source) => {
            return Err(source).with_context(|| {
                format!(
                    "failed to read extracted app executable metadata '{}'",
                    executable.display()
                )
            });
        }
    };

    ensure!(
        metadata.is_file(),
        "macOS update archive app executable is not a file: {}",
        executable.display()
    );

    Ok(())
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
    fn detects_app_bundle() {
        let exe = Path::new("/Applications/Chipmunk.app/Contents/MacOS/chipmunk");

        let bundle = app_bundle_path(exe).unwrap();

        assert_eq!(bundle, PathBuf::from("/Applications/Chipmunk.app"));
    }

    #[test]
    fn accepts_renamed_app_bundle_for_archive_target() {
        let exe = Path::new("/Applications/Trace.app/Contents/MacOS/chipmunk");

        let bundle = app_bundle_path(exe).unwrap();

        assert_eq!(bundle, PathBuf::from("/Applications/Trace.app"));
        assert!(!is_chipmunk_app(&bundle));
    }

    #[test]
    fn rejects_non_bundle_executable() {
        let exe = Path::new("/usr/local/bin/chipmunk");

        assert_eq!(app_bundle_path(exe), None);
    }

    #[test]
    fn archive_replacement_preserves_renamed_bundle() {
        let dir = tempdir().unwrap();
        let current_bundle = write_bundle(dir.path(), "Trace.app", b"old");
        write_file(
            &current_bundle.join("Contents/Resources/old.txt"),
            b"old resource",
        );

        let archive_path = dir.path().join("update.tgz");
        write_tgz(
            &archive_path,
            &[("chipmunk.app/Contents/MacOS/chipmunk", b"new".as_slice())],
        );

        let target = current_bundle.join(MAC_APP_EXECUTABLE);
        replace_archive_for_target(&archive_path, dir.path(), &target).unwrap();

        assert_eq!(
            fs::read(current_bundle.join(MAC_APP_EXECUTABLE)).unwrap(),
            b"new"
        );
        assert!(!dir.path().join(DEFAULT_MAC_APP_BUNDLE).exists());
        assert!(archive_stage_dirs(dir.path()).is_empty());
    }

    #[test]
    fn archive_replacement_requires_root_bundle() {
        let dir = tempdir().unwrap();
        let current_bundle = write_bundle(dir.path(), "Trace.app", b"old");

        let archive_path = dir.path().join("update.tgz");
        write_tgz(&archive_path, &[("README.md", b"readme".as_slice())]);

        let target = current_bundle.join(MAC_APP_EXECUTABLE);
        assert!(replace_archive_for_target(&archive_path, dir.path(), &target).is_err());
        assert_eq!(fs::read(target).unwrap(), b"old");
        assert!(archive_stage_dirs(dir.path()).is_empty());
    }

    #[test]
    fn archive_replacement_rejects_install_dir_mismatch() {
        let dir = tempdir().unwrap();
        let other_dir = tempdir().unwrap();
        let current_bundle = write_bundle(dir.path(), "Trace.app", b"old");

        let archive_path = dir.path().join("update.tgz");
        write_tgz(
            &archive_path,
            &[("chipmunk.app/Contents/MacOS/chipmunk", b"new".as_slice())],
        );

        let target = current_bundle.join(MAC_APP_EXECUTABLE);
        assert!(replace_archive_for_target(&archive_path, other_dir.path(), &target).is_err());
        assert_eq!(fs::read(target).unwrap(), b"old");
    }

    #[test]
    fn archive_replacement_validates_new_bundle_before_copy() {
        let dir = tempdir().unwrap();
        let current_bundle = write_bundle(dir.path(), "Trace.app", b"old");

        let archive_path = dir.path().join("update.tgz");
        write_tgz(
            &archive_path,
            &[("chipmunk.app/Contents/Info.plist", b"plist".as_slice())],
        );

        let target = current_bundle.join(MAC_APP_EXECUTABLE);
        assert!(replace_archive_for_target(&archive_path, dir.path(), &target).is_err());
        assert_eq!(fs::read(target).unwrap(), b"old");
        assert!(archive_stage_dirs(dir.path()).is_empty());
    }

    #[test]
    fn x86_64_uses_portable_archive() {
        let workflow = UpdateWorkflow::Archive {
            install_dir: PathBuf::from("/Applications"),
        };
        let artifact_name = artifact_name(&version(), TargetArch::X86_64, &workflow).unwrap();

        assert_eq!(artifact_name, "chipmunk@4.0.0-darwin-portable.tgz");
    }

    #[test]
    fn aarch64_uses_arm64_portable_archive() {
        let workflow = UpdateWorkflow::Archive {
            install_dir: PathBuf::from("/Applications"),
        };
        let artifact_name = artifact_name(&version(), TargetArch::Aarch64, &workflow).unwrap();

        assert_eq!(artifact_name, "chipmunk@4.0.0-darwin-arm64-portable.tgz");
    }

    #[test]
    fn x86_64_uses_pkg() {
        let artifact_name =
            artifact_name(&version(), TargetArch::X86_64, &UpdateWorkflow::Pkg).unwrap();

        assert_eq!(artifact_name, "chipmunk@4.0.0-darwin.pkg");
    }

    #[test]
    fn aarch64_uses_arm64_pkg() {
        let artifact_name =
            artifact_name(&version(), TargetArch::Aarch64, &UpdateWorkflow::Pkg).unwrap();

        assert_eq!(artifact_name, "chipmunk@4.0.0-darwin-arm64.pkg");
    }

    fn archive_stage_dirs(root: &Path) -> Vec<PathBuf> {
        fs::read_dir(root)
            .unwrap()
            .map(|entry| entry.unwrap().path())
            .filter(|path| {
                path.file_name()
                    .unwrap()
                    .to_string_lossy()
                    .starts_with("archive-stage-")
            })
            .collect()
    }

    fn write_bundle(root: &Path, name: &str, executable_content: &[u8]) -> PathBuf {
        let bundle = root.join(name);
        write_file(&bundle.join(MAC_APP_EXECUTABLE), executable_content);
        bundle
    }

    fn write_file(path: &Path, content: &[u8]) {
        fs::create_dir_all(path.parent().unwrap()).unwrap();
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
