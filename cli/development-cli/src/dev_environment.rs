//! Manages the information and checks for the needed tools for Chipmunk development.
//!
//! Chipmunk is built using different technologies and need a variety of development tools to be
//! installed to build it and run it in development environment.

use std::fmt::Write;

use anyhow::bail;

use crate::{dev_tools::DevTool, shell::shell_std_command};

const VERSION_ARG: &str = "--version";

/// Resolve the paths for all development tool returning an Error if any of them can't be resolved
pub fn validate_dev_tools() -> anyhow::Result<()> {
    let mut errors = None;
    for tool in DevTool::all() {
        let cmd_status = shell_std_command()
            .arg(format! {"{} {VERSION_ARG}", tool.cmd()})
            .output();

        let err_opt = match cmd_status {
            Ok(out) => {
                if out.status.success() {
                    continue;
                } else {
                    None
                }
            }
            Err(err) => Some(err),
        };

        let error_lines =
            errors.get_or_insert(String::from("Following dependencies are missing:\n"));

        // Writing to string never fails
        writeln!(
            error_lines,
            "Required dependency '{tool}' is not installed.",
        )?;

        if let Some(err) = err_opt {
            writeln!(error_lines, "Resolve Error Info:{err}",)?;
        }

        if let Some(install_hint) = tool.install_hint() {
            writeln!(
                error_lines,
                "Consider installing it using the command '{install_hint}'"
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
