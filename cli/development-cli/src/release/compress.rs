//! Manages compressing the bundled Chipmunk app and CLI tool, providing one compressed file
//! for each per platform and including the current version of Chipmunk in the file name.

use std::{
    borrow::Cow,
    fs::{self, File},
    io::BufReader,
};

use anyhow::{Context, ensure};
use serde_json::Value;

use crate::{
    release::{
        metadata::{METADATA_FILENAME, metadata_path},
        paths::{cli_binary_dir, cli_binary_name, release_build_path, release_path},
    },
    shell::shell_tokio_command,
    target::Target,
};

use super::env_utls::is_arm_archit;

/// Compresses the bundled Chipmunk on the current platform, Creating one compressed file to be
/// used on releases.
/// * `custom_platform`: Optional Custom platform name to be used in archive name.
pub async fn compress(custom_platform: Option<&str>) -> anyhow::Result<()> {
    let release_file_name = release_file_name(custom_platform)?;
    let archname = format!("{release_file_name}.tgz");

    let mut tar_cmd = format!("tar -czf ../{archname} ");

    if cfg!(target_os = "macos") {
        tar_cmd.push_str("./chipmunk.app");
    } else {
        tar_cmd.push_str("* .release");
    };

    let metafile = metadata_path();
    if metafile.exists() {
        use std::fmt::Write;
        let _ = write!(&mut tar_cmd, " {METADATA_FILENAME}");
    }

    println!("Running command: '{tar_cmd}'");

    // We must call the shell and pass it all the arguments at once because we are using the shell
    // wild card `*` which can't be running without a shell.
    let mut command = shell_tokio_command();

    let release_build_path = release_build_path();
    let cmd_status = command
        .arg(tar_cmd)
        .current_dir(release_build_path)
        .kill_on_drop(true)
        .status()
        .await
        .context("Error while running compress command")?;

    ensure!(cmd_status.success(), "Release: Compress Command failed");

    let created_file_path = release_path().join(archname);

    ensure!(
        created_file_path.exists(),
        "Compressed file doesn't exist. Path {}",
        created_file_path.display()
    );

    println!(
        "Compressed file for release successfully created: {}",
        created_file_path.display()
    );

    Ok(())
}

/// Provides the release file on the current platform, reading and adding
/// Chipmunk version to the filename.
///
/// * `custom_platform`: Optional Custom platform name to be used in archive name,
///   to replace the default operating system when provided.
pub fn release_file_name(custom_platform: Option<&str>) -> anyhow::Result<String> {
    let version = chipmunk_version().context("Error while retrieving Chipmunk version")?;
    let platform = custom_platform.map_or_else(|| os_env_platform().into(), Cow::from);

    let file_name = format!("chipmunk@{version}-{platform}-portable");

    Ok(file_name)
}

/// Provides the platform for release file names based on the operating system and
/// the system's architecture.
fn os_env_platform() -> String {
    let mut platform = if cfg!(target_os = "linux") {
        String::from("linux")
    } else if cfg!(target_os = "macos") {
        String::from("darwin")
    } else if cfg!(target_os = "windows") {
        String::from("win64")
    } else {
        panic!(
            "Unknown target os: {}, Arch: {}",
            std::env::consts::OS,
            std::env::consts::ARCH
        );
    };

    if is_arm_archit() {
        platform.push_str("-arm64");
    }

    platform
}

/// Reads current Chipmunk version from `package.json` file.
fn chipmunk_version() -> anyhow::Result<String> {
    let package_path = Target::App.cwd().join("package.json");

    ensure!(
        package_path.exists(),
        "Electron `package.json` file doesn't exit. File path: {}",
        package_path.display()
    );

    let f = File::open(&package_path).with_context(|| {
        format!(
            "Error while opening Electron `package.json` file. File Path: {}",
            package_path.display()
        )
    })?;

    let reader = BufReader::new(f);

    let json_content: Value = serde_json::from_reader(reader)
        .context("Error while parsing Electron `package.json` file.")?;

    json_content
        .get("version")
        .and_then(|v| {
            if let Value::String(version) = v {
                Some(version.to_owned())
            } else {
                None
            }
        })
        .context("Chipmunk version doesn't exist in json value from Electron `package.json` file.")
}

/// Compresses the bundled Chipmunk CLI on the current platform, Creating one compressed file
/// to be used on releases.
pub async fn compress_cli(custom_platform: Option<&str>) -> anyhow::Result<()> {
    let release_file_name = cli_release_file_name(custom_platform)?;

    let arch_name = format!("{release_file_name}.tgz");

    let tar_cmd = format!(
        "tar -czf {arch_name} --directory={binary_path} {binary_name}",
        binary_path = cli_binary_dir().to_string_lossy(),
        binary_name = cli_binary_name()
    );

    println!("Running command: '{tar_cmd}'");

    // We must call the shell and pass it all the arguments at once because we are using the shell
    // wild card `*` which can't be running without a shell.
    let mut command = shell_tokio_command();

    let cmd_status = command
        .arg(tar_cmd)
        .current_dir(release_path())
        .kill_on_drop(true)
        .status()
        .await
        .context("Error while running compress command")?;

    ensure!(cmd_status.success(), "Release: Compress Command  failed");

    let created_file_path = release_path().join(arch_name);

    ensure!(
        created_file_path.exists(),
        "Chipmunk CLI compressed file doesn't exist. Path {}",
        created_file_path.display()
    );

    println!(
        "Compressed file for release successfully created: {}",
        created_file_path.display()
    );

    Ok(())
}

/// Provides the release file name for Chipmunk CLI on the current platform.
///
/// * `custom_platform`: Optional Custom platform name to be used in archive name,
///   to replace the default operating system when provided.
pub fn cli_release_file_name(custom_platform: Option<&str>) -> anyhow::Result<String> {
    let version = chipmunk_cli_version().context("Error while retrieving chipmunk cli version")?;
    let platform: Cow<_> = custom_platform
        .map(|p| p.into())
        .unwrap_or_else(|| os_env_platform().into());

    let file_name = format!("chipmunk-cli@{version}-{platform}-portable");

    Ok(file_name)
}

/// Reads current Chipmunk CLI version from `cargo.toml` file.
fn chipmunk_cli_version() -> anyhow::Result<String> {
    let cargo_path = Target::CliChipmunk.cwd().join("Cargo.toml");

    ensure!(
        cargo_path.exists(),
        "`Cargo.toml` file doesn't exit. File path: {}",
        cargo_path.display()
    );

    let cargo_content =
        fs::read_to_string(&cargo_path).context("Error while reading `Cargo.toml` file")?;

    let cargo_toml: toml::Table = cargo_content
        .parse()
        .context("Parsing content of `Cargo.toml` file failed")?;

    cargo_toml
        .get("package")
        .and_then(|pkg| pkg.get("version"))
        .and_then(|ver| {
            if let toml::Value::String(version) = ver {
                Some(version.to_owned())
            } else {
                None
            }
        })
        .context("Enable to find Chipmunk CLI version on `Cargo.toml` file")
}
