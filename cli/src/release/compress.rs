use std::{fs::File, io::BufReader};

use anyhow::{ensure, Context};
use serde_json::Value;

use crate::{release::paths::release_build_path, target::Target};

use super::env_utls::is_arm_archit;

pub async fn compress() -> anyhow::Result<()> {
    let release_file_name = release_file_name()?;
    let archname = format!("{}.tgz", release_file_name);

    let mut tar_cmd = format!("tar -czf ../{archname} ");

    if cfg!(target_os = "macos") {
        tar_cmd.push_str("./chipmunk.app");
    } else {
        tar_cmd.push_str("* .release");
    };

    println!("Running command: '{tar_cmd}'");

    // We must call the shell and pass it all the arguments at once because we are using the shell
    // wild card `*` which can't be running without a shell.
    // TODO AAZ: Use the crates `flate2` and `tar` to decompress directly.
    let mut command = if cfg!(target_os = "windows") {
        let mut cmd = tokio::process::Command::new("cmd");
        cmd.arg("/C");
        cmd
    } else {
        let mut cmd = tokio::process::Command::new("sh");
        cmd.arg("-c");
        cmd
    };

    let release_build_path = release_build_path();
    let cmd_status = command
        .arg(tar_cmd)
        .current_dir(release_build_path)
        .kill_on_drop(true)
        .status()
        .await
        .context("Error while running compress command")?;

    ensure!(cmd_status.success(), "Release: Compress Command failed");

    Ok(())
}

fn release_file_name() -> anyhow::Result<String> {
    let mut prefix = if cfg!(target_os = "linux") {
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
        prefix.push_str("-arm64");
    }

    let version = chipmunk_version().context("Error while retrieving Chipmunk version")?;

    let file_name = format!("chipmunk@{version}-{prefix}-portable");

    Ok(file_name)
}

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
