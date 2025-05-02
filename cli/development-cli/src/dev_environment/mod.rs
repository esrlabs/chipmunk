//! Manages the information and checks for the needed tools for Chipmunk development.
//!
//! Chipmunk is built using different technologies and need a variety of development tools to be
//! installed to build it and run it in development environment.

use core::str;
use std::{fmt::Write, io};

use anyhow::{bail, Context};
use console::style;
use min_versions::MinVersions;

use crate::{dev_tools::DevTool, shell::shell_std_command, version::Version};

mod min_versions;

const VERSION_ARG: &str = "--version";

/// The result of running a validation process for a development tool.
#[derive(Debug)]
enum ToolValidationResult {
    /// Tool is valid.
    Valid,
    /// Check is skipped.
    Skipped,
    /// Process command to get tool version failed with the command error when exists.
    CommandFailed(Option<io::Error>),
    /// Installed version of the tool is outdated.
    VersionOutdated {
        installed: Version,
        required: Version,
    },
}

/// Validates development tools required for Chipmunk development.
///
/// Checks installed development tools by running process commands to retrieve their versions
/// and comparing them against minimum required versions.
///
/// This function will validate all tools returning an error if any tool is invalid with the error
/// messages for all tools.
pub fn validate_dev_tools() -> anyhow::Result<()> {
    let min_versions = MinVersions::load().context("Loading minimal required versions failed")?;
    let mut errors = None;
    for tool in DevTool::all() {
        let error_msg = match validate_tool(*tool, &min_versions) {
            ToolValidationResult::Valid | ToolValidationResult::Skipped => continue,
            ToolValidationResult::CommandFailed(cmd_error) => {
                let mut err_msg = format!("Required dependency '{tool}' is not installed.");
                if let Some(cmd_error) = cmd_error {
                    writeln!(&mut err_msg)?;
                    write!(&mut err_msg, "Command Error info: {cmd_error}")?;
                }
                err_msg
            }
            ToolValidationResult::VersionOutdated {
                installed,
                required,
            } => {
                format!(
                    "Installed version for '{tool}' is outdated.\n\
                    Installed Version: {installed}. Minimum Required: {required}"
                )
            }
        };

        let error_lines =
            errors.get_or_insert(String::from("Following dependencies are missing:\n"));

        writeln!(error_lines, "{error_msg}")?;

        if let Some(install_hint) = tool.install_hint() {
            writeln!(
                error_lines,
                "Consider installing/updating it using the command '{install_hint}'"
            )?;
        }

        writeln!(
            error_lines,
            "------------------------------------------------------------------"
        )?;
    }

    match errors {
        Some(err_text) => bail!("{}", err_text.trim_end()),
        None => Ok(()),
    }
}

/// Checks if tool is installed by calling for its version then verify that
/// the installed version isn't outdated.
///
/// # Note:
///
/// This function will skip version validation if it's unable to parse its version from the
/// command output, while printing and error on the screen.
fn validate_tool(tool: DevTool, min_versions: &MinVersions) -> ToolValidationResult {
    let cmd_status = shell_std_command()
        .arg(format! {"{} {VERSION_ARG}", tool.cmd()})
        .output();

    match cmd_status {
        Ok(out) => {
            if !out.status.success() {
                return ToolValidationResult::CommandFailed(None);
            }
            // Ensure installed version matches or greater than minimal required version.
            let min_version = match min_versions.get_version(tool) {
                Some(min_version) => min_version,
                None => return ToolValidationResult::Skipped,
            };
            let output = String::from_utf8_lossy(&out.stdout);
            match Version::regex_extract(&output) {
                Ok(installed) => {
                    if &installed < min_version {
                        ToolValidationResult::VersionOutdated {
                            installed,
                            required: min_version.to_owned(),
                        }
                    } else {
                        ToolValidationResult::Valid
                    }
                }
                Err(error) => {
                    // Don't stop the whole process of parsing output errors.
                    // It's possible for this parsing to fail on future outputs
                    // and we want to avoid stopping all tasks because of that.
                    let msg = format!(
                        "Verifying {tool} version skipped due to error while parsing its version. Error: {error}"
                    );
                    eprintln!("{}", style(msg).yellow());

                    ToolValidationResult::Skipped
                }
            }
        }
        Err(err) => ToolValidationResult::CommandFailed(Some(err)),
    }
}

/// Prints the information of the needed tools for the development if available, otherwise prints
/// error information to `stderr`
pub fn print_env_info() -> anyhow::Result<()> {
    let mut errored = false;
    for tool in DevTool::all() {
        println!("{tool} Info:");
        let cmd = tool.cmd();
        match shell_std_command()
            .arg(format!("{cmd} {VERSION_ARG}"))
            .status()
        {
            Ok(s) => {
                if !s.success() {
                    errored = true;
                    eprintln!("Error while retrieving dependency's information");
                }
            }
            Err(err) => {
                errored = true;
                eprintln!("Error while retrieving dependency's information: {err}")
            }
        }
        println!("------------------------------------------------------------------");
    }

    if errored {
        bail!("Error(s) while resolving development tools");
    }

    Ok(())
}
