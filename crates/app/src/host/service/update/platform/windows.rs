//! Windows update artifact contract, install detection, and portable replacement.
//!
//! Windows keeps a running `.exe` file locked, so Chipmunk cannot replace its
//! own executable before the process exits. Archive updates therefore split the
//! work in two parts: Rust validates and prepares all files while the UI is
//! still open, then a visible PowerShell helper waits for Chipmunk to exit and
//! performs the final single-file replacement.

use std::{
    env,
    ffi::OsStr,
    fs,
    path::{Path, PathBuf},
    process::{self, Command as StdCommand},
    thread::sleep,
    time::{Duration, Instant},
};

use anyhow::{Context, bail, ensure};
use semver::Version;
use uuid::Uuid;

use super::super::archive;
use super::{
    InstallerError, TargetArch, UpdateWorkflow, UpdateWorkflowErr, archive_install_dir,
    current_executable_target, executable_paths, release_asset_name, replacement_temp_path,
    select_archive_workflow, spawn_installer_command,
};

const WINDOWS_EXECUTABLE: &str = "chipmunk.exe";

/// Returns the Windows artifact name for a supported architecture and workflow.
pub fn artifact_name(
    version: &Version,
    arch: TargetArch,
    workflow: &UpdateWorkflow,
) -> Option<String> {
    match (arch, workflow) {
        (TargetArch::X86_64, UpdateWorkflow::Archive { .. }) => {
            Some(release_asset_name(version, "win64", "-portable.tgz"))
        }
        (TargetArch::X86_64, UpdateWorkflow::Msi) => {
            Some(release_asset_name(version, "win64", ".msi"))
        }
        (TargetArch::X86_64, UpdateWorkflow::Deb | UpdateWorkflow::Rpm | UpdateWorkflow::Pkg)
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

/// Launches an MSI package through Windows Installer.
pub fn install_msi(path: &Path) -> Result<(), InstallerError> {
    spawn_installer_command("msiexec", [OsStr::new("/i"), path.as_os_str()])
}

/// Prepares a portable archive replacement and launches the visible Windows helper.
///
/// The helper owns only the post-exit file swap. Extraction, archive layout
/// validation, write-access checks, and helper launch failures are handled here
/// so the Host UI can still cancel shutdown and report those errors.
pub fn replace_archive(archive_path: &Path, install_dir: &Path) -> anyhow::Result<()> {
    let target = current_executable_target()?;
    let prepared = prepare_archive_replacement(archive_path, install_dir, &target)?;
    spawn_update_helper(
        &prepared.script_path,
        process::id(),
        &target,
        &prepared.replacement_path,
    )
}

fn prepare_archive_replacement(
    archive_path: &Path,
    install_dir: &Path,
    target: &Path,
) -> anyhow::Result<ArchiveReplacement> {
    verify_install_dir(install_dir, target)?;

    // The downloaded Windows portable archive is flat. Only chipmunk.exe is
    // part of the replacement contract; README.md and .release are ignored.
    let stage_dir = archive_stage_dir(archive_path);
    fs::create_dir_all(&stage_dir).with_context(|| {
        format!(
            "failed to prepare update archive extraction directory '{}'",
            stage_dir.display()
        )
    })?;
    archive::unpack_archive(archive_path, &stage_dir)
        .context("failed to unpack Windows update archive")?;

    let archive_executable = stage_dir.join(WINDOWS_EXECUTABLE);
    let replacement_path = prepare_executable_from_archive(&archive_executable, target)?;

    // Keep the helper script with the extracted archive so post-close failures
    // can still be shown even after Chipmunk has exited.
    const UPDATE_HELPER_SCRIPT: &str = "chipmunk-update.ps1";
    let script_path = stage_dir.join(UPDATE_HELPER_SCRIPT);
    fs::write(&script_path, update_helper_script()).with_context(|| {
        format!(
            "failed to write Windows update helper script '{}'",
            script_path.display()
        )
    })?;

    let archive_replacement = ArchiveReplacement {
        script_path,
        replacement_path,
    };

    Ok(archive_replacement)
}

struct ArchiveReplacement {
    script_path: PathBuf,
    replacement_path: PathBuf,
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

fn prepare_executable_from_archive(
    archive_executable: &Path,
    target: &Path,
) -> anyhow::Result<PathBuf> {
    validate_archive_executable(archive_executable)?;

    // Copy into the install directory before shutdown. This proves the target
    // directory is writable and lets PowerShell do a same-directory replacement.
    let target_parent = target.parent().with_context(|| {
        format!(
            "current executable target has no parent directory: {}",
            target.display()
        )
    })?;
    let replacement_path = replacement_temp_path(target_parent, target);

    fs::copy(archive_executable, &replacement_path).with_context(|| {
        format!(
            "failed to copy extracted executable from '{}' to '{}'",
            archive_executable.display(),
            replacement_path.display()
        )
    })?;

    Ok(replacement_path)
}

fn validate_archive_executable(archive_executable: &Path) -> anyhow::Result<()> {
    let metadata = match fs::metadata(archive_executable) {
        Ok(metadata) => metadata,
        Err(source) if source.kind() == std::io::ErrorKind::NotFound => {
            bail!(
                "Windows update archive does not contain a root chipmunk.exe executable: {}",
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
        "Windows update archive root chipmunk.exe entry is not a file: {}",
        archive_executable.display()
    );

    Ok(())
}

fn spawn_update_helper(
    script_path: &Path,
    parent_pid: u32,
    target: &Path,
    replacement_path: &Path,
) -> anyhow::Result<()> {
    // PowerShell is available on supported Windows machines and gives users a
    // visible terminal for post-close success or failure.
    let mut command = StdCommand::new("powershell.exe");
    command
        .arg("-NoProfile")
        .arg("-ExecutionPolicy")
        .arg("Bypass")
        .arg("-File")
        .arg(script_path)
        .arg("-ParentPid")
        .arg(parent_pid.to_string())
        .arg("-Target")
        .arg(target)
        .arg("-Replacement")
        .arg(replacement_path);

    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;

        // Open the helper in its own terminal so it can show post-close update results.
        const CREATE_NEW_CONSOLE: u32 = 0x0000_0010;
        command.creation_flags(CREATE_NEW_CONSOLE);
    }

    let mut child = command
        .spawn()
        .context("failed to launch Windows update helper")?;

    wait_for_helper_launch(&mut child)
}

fn wait_for_helper_launch(child: &mut process::Child) -> anyhow::Result<()> {
    // Only early launch failures can be reported through Chipmunk. Once the
    // helper keeps running, later replacement results are shown in its terminal.
    let check_timeout = Duration::from_secs(1);
    let check_interval = Duration::from_millis(200);
    let deadline = Instant::now() + check_timeout;

    loop {
        match child.try_wait() {
            Ok(Some(status)) => {
                ensure!(
                    status.success(),
                    "Windows update helper exited early with status {status}"
                );
                return Ok(());
            }
            Ok(None) => {}
            Err(err) => {
                log::warn!("Failed to check Windows update helper process status: {err:#}");
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

fn update_helper_script() -> &'static str {
    // File.Replace performs a single-file replacement without keeping a backup.
    // Retries cover the short period where Windows or antivirus software may
    // still hold the executable after the Chipmunk process exits.
    r#"param(
    [Parameter(Mandatory = $true)] [int] $ParentPid,
    [Parameter(Mandatory = $true)] [string] $Target,
    [Parameter(Mandatory = $true)] [string] $Replacement
)

try {
    $Host.UI.RawUI.WindowTitle = "Chipmunk Update"
} catch {}

$ErrorActionPreference = "Stop"
$Succeeded = $false

try {
    Write-Host "Chipmunk update is waiting for the application to close..."
    $Parent = Get-Process -Id $ParentPid -ErrorAction SilentlyContinue
    if ($null -ne $Parent) {
        Wait-Process -Id $ParentPid -ErrorAction SilentlyContinue
    }

    Write-Host "Replacing Chipmunk executable..."
    $Deadline = (Get-Date).AddSeconds(60)
    $LastError = $null

    while ((Get-Date) -lt $Deadline) {
        try {
            [System.IO.File]::Replace($Replacement, $Target, $null, $true)
            $Succeeded = $true
            Write-Host "Chipmunk was updated successfully."
            break
        } catch {
            $LastError = $_
            Start-Sleep -Milliseconds 500
        }
    }

    if (-not $Succeeded) {
        if ($null -ne $LastError) {
            throw $LastError
        }

        throw "Timed out while replacing Chipmunk executable."
    }
} catch {
    Write-Host ""
    Write-Host "Chipmunk update failed:"
    Write-Host $_.Exception.Message
} finally {
    Write-Host ""
    Read-Host "Press Enter to close" | Out-Null
}

if ($Succeeded) {
    exit 0
}

exit 1
"#
}

/// Detects the Windows update workflow for the executable path.
pub async fn detect_install_workflow(exe: &Path) -> Result<UpdateWorkflow, UpdateWorkflowErr> {
    let paths = executable_paths(exe.to_path_buf());

    if paths.iter().any(|path| installed_in_program_files(path)) {
        return Ok(UpdateWorkflow::Msi);
    }

    let install_dir = archive_install_dir(exe)?;
    select_archive_workflow(install_dir)
}

fn installed_in_program_files(path: &Path) -> bool {
    // MSI installs normally live under Program Files. We treat that location as
    // enough evidence to use the MSI workflow instead of archive replacement.
    let roots = [
        env::var_os("ProgramFiles"),
        env::var_os("ProgramFiles(x86)"),
    ]
    .into_iter()
    .flatten()
    .filter_map(|root| fs::canonicalize(root).ok())
    .collect::<Vec<_>>();

    roots.iter().any(|root| is_under_root(path, root))
}

fn is_under_root(path: &Path, root: &Path) -> bool {
    path.starts_with(root)
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
    fn detects_program_files_install() {
        let root = Path::new("/Program Files");
        let exe = Path::new("/Program Files/Chipmunk/chipmunk.exe");

        assert!(is_under_root(exe, root));
    }

    #[test]
    fn program_files_check_rejects_prefix_match() {
        let root = Path::new("/Program Files");
        let exe = Path::new("/Program Files Portable/Chipmunk/chipmunk.exe");

        assert!(!is_under_root(exe, root));
    }

    #[test]
    fn archive_replacement_prepares_temp_executable() {
        let dir = tempdir().unwrap();
        let target = dir.path().join("Trace.exe");
        write_file(&target, b"old");

        let archive_path = dir.path().join("update.tgz");
        write_tgz(
            &archive_path,
            &[
                (WINDOWS_EXECUTABLE, b"new".as_slice()),
                ("README.md", b"readme".as_slice()),
            ],
        );

        let prepared = prepare_archive_replacement(&archive_path, dir.path(), &target).unwrap();

        assert_eq!(fs::read(&target).unwrap(), b"old");
        assert_eq!(fs::read(prepared.replacement_path).unwrap(), b"new");
        assert!(prepared.script_path.exists());
    }

    #[test]
    fn archive_replacement_requires_root_executable() {
        let dir = tempdir().unwrap();
        let target = dir.path().join("chipmunk.exe");
        write_file(&target, b"old");

        let archive_path = dir.path().join("update.tgz");
        write_tgz(&archive_path, &[("README.md", b"readme".as_slice())]);

        assert!(prepare_archive_replacement(&archive_path, dir.path(), &target).is_err());
        assert_eq!(fs::read(&target).unwrap(), b"old");
    }

    #[test]
    fn archive_replacement_rejects_install_dir_mismatch() {
        let dir = tempdir().unwrap();
        let other_dir = tempdir().unwrap();
        let target = dir.path().join("chipmunk.exe");
        write_file(&target, b"old");

        let archive_path = dir.path().join("update.tgz");
        write_tgz(&archive_path, &[(WINDOWS_EXECUTABLE, b"new".as_slice())]);

        assert!(prepare_archive_replacement(&archive_path, other_dir.path(), &target).is_err());
        assert_eq!(fs::read(&target).unwrap(), b"old");
    }

    #[test]
    fn x86_64_uses_portable_archive() {
        let workflow = UpdateWorkflow::Archive {
            install_dir: Path::new("C:/chipmunk").to_path_buf(),
        };
        let artifact_name = artifact_name(&version(), TargetArch::X86_64, &workflow).unwrap();

        assert_eq!(artifact_name, "chipmunk@4.0.0-win64-portable.tgz");
    }

    #[test]
    fn x86_64_uses_msi() {
        let artifact_name =
            artifact_name(&version(), TargetArch::X86_64, &UpdateWorkflow::Msi).unwrap();

        assert_eq!(artifact_name, "chipmunk@4.0.0-win64.msi");
    }

    #[test]
    fn aarch64_is_not_supported() {
        assert_eq!(
            artifact_name(&version(), TargetArch::Aarch64, &UpdateWorkflow::Msi),
            None
        );
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
