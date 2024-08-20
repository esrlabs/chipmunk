use std::{
    env,
    io::{BufWriter, Write},
};

use console::style;
use env_utls::{
    is_arm_archit, APPLEIDPASS_ENV, APPLEID_ENV, CSC_IDENTITY_AUTO_DISCOVERY_ENV, SKIP_NOTARIZE_ENV,
};
use fs::File;
use paths::release_bin_path;

use super::*;
use crate::target::{ProcessCommand, Target};

pub async fn bundle_release() -> anyhow::Result<()> {
    debug_assert!(
        !get_tracker().show_bars(),
        "Release shouldn't run with UI bars"
    );

    // Sets the needed environment variables before running bundling command.
    // SAFETY: bundle_release() is used in a non concurrence scenario and setting environment
    // variables wouldn't produce an undefined behavior.
    unsafe {
        set_env_vars();
    }

    // Run build bundle command
    println!("{}", style("Start Build Bundle command...").blue().bright());
    let build_cmd = build_cmd();
    let pwd = Target::App.cwd();
    let status = tokio::process::Command::new(build_cmd.cmd)
        .args(build_cmd.args)
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

    // Creating File Snapshot

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

/// Sets needed environment variables before calling bundling command.
///
/// # SAFETY:
///
/// The functions sets environment variables and it would produced undefined behavior if used in
/// concurrence scenario.
unsafe fn set_env_vars() {
    if env::var(SKIP_NOTARIZE_ENV).is_ok() {
        env::set_var(CSC_IDENTITY_AUTO_DISCOVERY_ENV, "false");

        return;
    }

    if cfg!(target_os = "macos") {
        if env::var(APPLEID_ENV).is_ok() && env::var(APPLEIDPASS_ENV).is_ok() {
            env::set_var(CSC_IDENTITY_AUTO_DISCOVERY_ENV, "true");
        }
    } else {
        env::set_var(CSC_IDENTITY_AUTO_DISCOVERY_ENV, "false");
    }
}

fn build_cmd() -> ProcessCommand {
    // `cfg!` macro is used instead of `cfg` attribute to keep linting and build checks
    // activated on all method independent from development environment.
    if cfg!(target_os = "linux") {
        build_cmd_linux()
    } else if cfg!(target_os = "macos") {
        build_cmd_mac()
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

fn build_cmd_linux() -> ProcessCommand {
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

fn build_cmd_mac() -> ProcessCommand {
    let is_arm = is_arm_archit();

    if env::var(APPLEID_ENV).is_ok()
        && env::var(APPLEIDPASS_ENV).is_ok()
        && env::var(SKIP_NOTARIZE_ENV).is_err()
    {
        if is_arm {
            let cmd = electron_builder_cmd();
            let args = vec![
                String::from("--mac"),
                String::from("--dir"),
                String::from("--config=./electron.config.darwin.arm64.json"),
            ];
            ProcessCommand::new(cmd, args)
        } else {
            let cmd = electron_builder_cmd();
            let args = vec![
                String::from("--mac"),
                String::from("--dir"),
                String::from("--config=./electron.config.darwin.x86.json"),
            ];
            ProcessCommand::new(cmd, args)
        }
    } else {
        if is_arm {
            let cmd = electron_builder_cmd();
            let args = vec![
                String::from("--mac"),
                String::from("--dir"),
                String::from("--config=./electron.config.darwin.arm64.json"),
                String::from(" -c.mac.identity=null"),
            ];
            ProcessCommand::new(cmd, args)
        } else {
            let cmd = electron_builder_cmd();
            let args = vec![
                String::from("--mac"),
                String::from("--dir"),
                String::from("--config=./electron.config.darwin.x86.json"),
                String::from(" -c.mac.identity=null"),
            ];
            ProcessCommand::new(cmd, args)
        }
    }
}

fn build_cmd_windows() -> ProcessCommand {
    let cmd = electron_builder_cmd();
    let args = vec![
        String::from("--win"),
        String::from("--dir"),
        String::from("--config=./electron.config.win.json"),
    ];

    ProcessCommand::new(cmd, args)
}

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
