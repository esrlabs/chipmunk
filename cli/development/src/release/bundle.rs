//! Manages bundling chipmunk after being built, providing a snapshot file when needed.

use std::io::{BufWriter, Write};

use console::style;
use env_utls::is_arm_archit;
use fs::File;
use paths::release_bin_path;

use super::*;
use crate::{
    shell::shell_tokio_command,
    target::{ProcessCommand, Target},
};

/// Runs bundle command on the already built Chipmunk, providing a snapshot file if needed.
pub async fn bundle_release() -> anyhow::Result<()> {
    debug_assert!(
        !get_tracker().show_bars(),
        "Release shouldn't run with UI bars"
    );

    // *** Run build bundle command ***

    println!("{}", style("Start Build Bundle command...").blue().bright());
    let build_cmd = bundle_cmd().context("Error while retrieving command to bundle release")?;
    let pwd = Target::App.cwd();
    let status = shell_tokio_command()
        .arg(build_cmd.combine())
        .current_dir(pwd)
        .kill_on_drop(true)
        .status()
        .await
        .context("Error while running bundle release command")?;

    ensure!(status.success(), "Release: Bundle command failed");

    println!("{}", style("Build Bundle Command succeeded...").green());

    println!();
    println!("-----------------------------------------------");
    println!();

    // *** Create File Snapshot ***

    println!(
        "{}",
        style("Start creating files snapshot...").blue().bright()
    );

    create_snapshot().await?;

    println!(
        "{}",
        style("files snapshot has been successfully created...").green()
    );

    println!();
    println!("-----------------------------------------------");
    println!();

    Ok(())
}

/// Provide the command to bundle Chipmunk on the current platform
fn bundle_cmd() -> anyhow::Result<ProcessCommand> {
    // `cfg!` macro is used instead of `cfg` attribute to keep linting and build checks
    // activated on all method independent from development environment.
    if cfg!(target_os = "linux") {
        Ok(bundle_cmd_linux())
    } else if cfg!(target_os = "macos") {
        Ok(build_cmd_mac())
    } else if cfg!(target_os = "windows") {
        build_cmd_windows()
    } else {
        panic!(
            "Unknown target os: {}, Arch: {}",
            std::env::consts::OS,
            std::env::consts::ARCH
        );
    }
}

/// Provide bundle command on Linux
fn bundle_cmd_linux() -> ProcessCommand {
    let cmd = electron_builder_cmd();
    let args = vec![
        String::from("--linux"),
        String::from("--dir"),
        String::from("--config=./electron.config.linux.json"),
    ];

    ProcessCommand::new(cmd, args)
}

fn electron_builder_cmd() -> String {
    Target::App
        .cwd()
        .join("node_modules")
        .join(".bin")
        .join("electron-builder")
        .to_string_lossy()
        .into()
}

/// Provide bundle command on Mac
fn build_cmd_mac() -> ProcessCommand {
    if is_arm_archit() {
        let cmd = electron_builder_cmd();
        let args = vec![
            String::from("--mac"),
            String::from("--dir"),
            String::from("--config=./electron.config.darwin.arm64.json"),
            String::from("-c.mac.identity=null"),
        ];
        ProcessCommand::new(cmd, args)
    } else {
        let cmd = electron_builder_cmd();
        let args = vec![
            String::from("--mac"),
            String::from("--dir"),
            String::from("--config=./electron.config.darwin.x86.json"),
            String::from("-c.mac.identity=null"),
        ];
        ProcessCommand::new(cmd, args)
    }
}

/// Provide bundle command on Windows
fn build_cmd_windows() -> anyhow::Result<ProcessCommand> {
    let cmd = electron_builder_cmd();
    let args = vec![
        String::from("--win"),
        String::from("--dir"),
        String::from("--config=./electron.config.win.json"),
    ];

    Ok(ProcessCommand::new(cmd, args))
}

/// Creates snapshot file if needed.
async fn create_snapshot() -> anyhow::Result<()> {
    if cfg!(target_os = "macos") {
        println!("build for darwin doesn't require snapshot");

        return Ok(());
    }

    let release_bin = release_bin_path();
    const SNAPSHOT_FILE_NAME: &str = ".release";

    let snapshot_file = release_bin.join(SNAPSHOT_FILE_NAME);
    if snapshot_file.exists() {
        println!(
            "Removing already existing snapshot file to be rewritten. File: {}",
            snapshot_file.display()
        );
        fs::remove_file(&snapshot_file).context("Error while removing snapshot file")?;
    }

    let mut entries = vec![String::from(SNAPSHOT_FILE_NAME)];

    let bin_entries = fs::read_dir(&release_bin)
        .with_context(|| {
            format!(
                "Error while reading release bin directory. Path: {}",
                release_bin.display()
            )
        })?
        .filter_map(|f| f.ok())
        .filter_map(|f| f.file_name().into_string().ok())
        .filter(|f| f.as_str() != "." && f.as_str() != "..");

    entries.extend(bin_entries);

    let f = File::create(snapshot_file).context("Error while creating snapshot file")?;
    let mut writer = BufWriter::new(f);
    for entry in entries {
        writeln!(writer, "{entry}").context("Error while writing to snapshot file")?;
    }

    Ok(())
}
