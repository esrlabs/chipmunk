//! Manages code signing and notarizing on MacOS.

use std::{env, io::BufRead};

use anyhow::{ensure, Context};
use serde::{Deserialize, Serialize};

use crate::{
    release::{
        compress::release_file_name,
        paths::{release_build_path, release_path},
    },
    shell::shell_std_command,
    target::Target,
};

#[derive(Debug, Clone, Serialize, Deserialize)]
/// Represents the configurations needed for code signing on MacOS
pub struct MacOsConfig {
    /// Needed environment variables while code signing
    env_vars: EnvironmentVariables,
    /// Provided Options to be given as arguments for the standard code signing command
    /// for files and directories to be
    sign_cmd_options: String,
    /// Paths for files and directories to be code signed.
    sign_paths: SignPaths,
    /// Final signing command with deep and strict flags.
    final_sign_command: FinalSignCommand,
    /// Command used in notarizing process.
    notarize_command: NotarizeCommand,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
/// Represents the needed environment variables while code signing
struct EnvironmentVariables {
    /// Variable that must be activated to start code signing
    check_enabled: Vec<String>,
    /// Variable that can't exist to start code signing
    check_disabled: Vec<String>,
    /// Variables to set by the start of code signing
    set_on_start: Vec<(String, String)>,
    /// Variable name for signing id.
    signing_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
/// Represents relative paths and glob patterns which must be code signed.
/// All paths starts form `release build path`
struct SignPaths {
    /// Paths to single files and directories
    single_paths: Vec<String>,
    /// Patterns to be used with glob to retrieve all matching files under that patterns.
    glob_patterns: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
/// Represents the components for the final sign command (Command for deep and strict code signing)
struct FinalSignCommand {
    /// Command and its arguments.
    command: String,
    /// Relative path to be code signed starting from `release build path`
    sign_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
/// Represents the code notarizing command with its arguments and environment variables.
struct NotarizeCommand {
    /// Notarize command with each arguments before providing the path.
    command: String,
    /// Environment variable for Apple ID to be provided as CLI argument.
    env_apple_id: String,
    /// Environment variable for Team ID to be provided as CLI argument.
    env_team_id: String,
    /// Environment variable for Password to be provided as CLI argument.
    env_password: String,
    /// Line to look for in the output of the notarizing command to ensure it has been accepted.
    accepted_line: String,
}

/// Check if code signing and notarizing is allowed according to the environment variables.
pub fn allowed(config: &MacOsConfig) -> bool {
    config
        .env_vars
        .check_enabled
        .iter()
        .all(|e| env::var(e).is_ok())
        && config
            .env_vars
            .check_disabled
            .iter()
            .all(|e| env::var(e).is_err())
}

/// Applies code signing form the given configurations.
///
/// # Panic:
///
/// This function panics if code signing isn't allowed according to environment variables.
pub fn apply_codesign(config: &MacOsConfig) -> anyhow::Result<()> {
    assert!(allowed(config), "Code sign isn't allowed");

    // Set environment variable on start
    for (key, value) in config.env_vars.set_on_start.iter() {
        env::set_var(key, value);
    }

    let app_root = Target::App.cwd();
    let release_build_path = release_build_path();

    let release_build_path_str = release_build_path.to_string_lossy();

    // Retrieve sign paths
    let mut sign_paths: Vec<_> = Vec::new();

    // First: glob paths.
    for glob_path in config
        .sign_paths
        .glob_patterns
        .iter()
        .map(|p| format!("{release_build_path_str}/{p}"))
    {
        let paths: Vec<_> = glob::glob(&glob_path)
            .context("Error while retrieving file paths via glob")?
            .flat_map(|p| p.ok())
            .filter(|p| p.is_file())
            .filter(|p| !p.is_symlink())
            .collect();

        sign_paths.extend(paths);
    }

    // Second: single paths.
    sign_paths.extend(
        config
            .sign_paths
            .single_paths
            .iter()
            .map(|p| release_build_path.join(p)),
    );

    // Start signing files
    let sign_id = env::var(&config.env_vars.signing_id)
        .context("Error while retrieving signing ID environment variable")?;
    for path in sign_paths {
        let cmd = format!(
            "codesign --sign \"{sign_id}\" {} \"{}\"",
            config.sign_cmd_options,
            path.to_string_lossy()
        );
        println!("DEBUG: CodeSign CMD: '{cmd}'");
        let cmd_status = shell_std_command()
            .arg(&cmd)
            .current_dir(&app_root)
            .status()
            .context("Error while running command codesign for files.")?;

        ensure!(cmd_status.success(), "Codesign failed. Command : '{cmd}'");
    }

    // Deep struct command
    let final_sign_path = release_build_path.join(&config.final_sign_command.sign_path);
    let final_cmd = format!(
        "{} {}",
        config.final_sign_command.command,
        final_sign_path.to_string_lossy()
    );
    let cmd_status = shell_std_command()
        .arg(&final_cmd)
        .current_dir(&app_root)
        .status()
        .with_context(|| format!("Error while running final sign command. Command: {final_cmd}"))?;

    ensure!(
        cmd_status.success(),
        "Final Codesign failed. Command : '{final_cmd}'"
    );

    Ok(())
}

pub fn notarize(config: &MacOsConfig) -> anyhow::Result<()> {
    assert!(allowed(config), "Code notarizing isn't allowed");
    let apple_id = env::var(&config.notarize_command.env_apple_id).with_context(|| {
        format!(
            "Error while retrieving environment variable: {}",
            config.notarize_command.env_apple_id
        )
    })?;

    let team_id = env::var(&config.notarize_command.env_team_id).with_context(|| {
        format!(
            "Error while retrieving environment variable: {}",
            config.notarize_command.env_team_id
        )
    })?;

    let password = env::var(&config.notarize_command.env_password).with_context(|| {
        format!(
            "Error while retrieving environment variable: {}",
            config.notarize_command.env_password
        )
    })?;

    let release_file_name = release_file_name()?;
    let archname = format!("{}.tgz", release_file_name);
    let release_file_path = release_path().join(archname);

    let cmd = format!(
        "{} \"{}\"  --apple-id \"{apple_id}\" --team-id \"{team_id}\" --password \"{password}\"",
        config.notarize_command.command,
        release_file_path.to_string_lossy()
    );

    let app_root = Target::App.cwd();

    let cmd_output = shell_std_command()
        .arg(&cmd)
        .current_dir(&app_root)
        .output()
        .context("Error while running notarize command.")?;

    let mut accepted = false;

    println!("Notarize commnad output on stdout:");
    for line in cmd_output.stdout.lines().map_while(Result::ok) {
        println!("{line}");
        if !accepted && line.trim() == config.notarize_command.accepted_line.as_str() {
            accepted = true;
        }
    }

    println!("---------------------------------");

    println!("Notarize commnad output on stderr:");
    for line in cmd_output.stderr.lines().map_while(Result::ok) {
        println!("{line}");
        if !accepted && line.trim() == config.notarize_command.accepted_line.as_str() {
            accepted = true;
        }
    }

    ensure!(
        cmd_output.status.success(),
        "Code notarize failed. Command : '{}'",
        cmd.replace(&apple_id, "***")
            .replace(&team_id, "***")
            .replace(&password, "***")
    );

    ensure!(
        accepted,
        r"Accepted line couldn't be found in notarize command output
Ensure that the content of the `accepted_line` field in the codesign configuration file is included as a single line in the output of the notarize command"
    );

    Ok(())
}

/// Used only during development to create a prototype configuration for serialization and generating
/// configurations files for prototyping.
pub fn __generate_config_for_prototyping() -> MacOsConfig {
    let env_vars = EnvironmentVariables {
        check_enabled: vec!["APPLEID".into(), "APPLEIDPASS".into()],
        check_disabled: vec!["SKIP_NOTARIZE".into()],
        set_on_start: vec![("CSC_IDENTITY_AUTO_DISCOVERY".into(), "true".into())],
        signing_id: String::from("SIGNING_ID"),
    };

    let sign_cmd_options = String::from("--force --timestamp --options runtime --verbose --deep --strict --entitlements ./resources/mac/entitlements.mac.plist");

    let sign_paths = SignPaths {
        single_paths: vec![
            String::from("chipmunk.app/Contents/Resources/bin/updater"),
            String::from("chipmunk.app/Contents/MacOS/chipmunk"),
            String::from("chipmunk.app"),
        ],
        glob_patterns: vec![String::from(
            "chipmunk.app/Contents/Frameworks/*.framework/Versions/A/**/**",
        )],
    };

    let final_sign_command = FinalSignCommand {
        command: String::from("codesign -vvv --deep --strict"),
        sign_path: String::from("chipmunk.app"),
    };

    let notarize_command = NotarizeCommand {
        command: String::from("xcrun notarytool submit --force --wait --verbose"),
        env_apple_id: String::from("APPLEID"),
        env_team_id: String::from("TEAMID"),
        env_password: String::from("APPLEIDPASS"),
        accepted_line: String::from("status: Accepted"),
    };

    MacOsConfig {
        env_vars,
        sign_cmd_options,
        sign_paths,
        final_sign_command,
        notarize_command,
    }
}
