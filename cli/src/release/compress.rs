use std::{fs::File, io::BufReader};

use anyhow::{ensure, Context};
use serde_json::Value;

use crate::{
    release::paths::release_bin_path,
    target::{ProcessCommand, Target},
};

use super::env_utls::is_arm_archit;

pub async fn compress() -> anyhow::Result<()> {
    let release_file_name = release_file_name()?;
    let archname = format!("{}.tgz", release_file_name);
    let target = if cfg!(target_os = "macos") {
        "./chipmunk.app"
    } else {
        "* .release"
    };

    // duration = Shell.timed_sh "tar -czf ../#{@archname} #{target}", "compress #{target}"
    let compress_cmd = ProcessCommand::new(
        String::from("tar"),
        vec![
            String::from("-czf"),
            format!("../{archname}"),
            String::from(target),
        ],
    );

    println!(
        "Running command: '{} {}'",
        &compress_cmd.cmd,
        compress_cmd.args.join(" ")
    );

    let release_bin = release_bin_path();
    let cmd_status = tokio::process::Command::new(compress_cmd.cmd)
        .args(compress_cmd.args)
        .current_dir(release_bin)
        .kill_on_drop(true)
        .status()
        .await
        .context("Error while running compress command")?;

    ensure!(cmd_status.success(), "Release: Compress Command failed");

    // TODO: Get release build path and apply compressing on it using tar.
    todo!()
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
        .map(|v| v.to_string())
        .context("Chipmunk version doesn't exist in json value from Electron `package.json` file.")
}
