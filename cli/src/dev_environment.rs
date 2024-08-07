use std::{fmt::Write, process::Command};

use anyhow::bail;

use crate::dev_tools::DevTool;

/// Resolve the paths for all development tool returning an Error if any of them can't be resolved
pub fn resolve_dev_tools() -> anyhow::Result<()> {
    let mut errors = None;
    for tool in DevTool::all() {
        let Err(err) = tool.resolve_path() else {
            continue;
        };

        let error_lines =
            errors.get_or_insert(String::from("Following dependencies are missing:\n"));

        // Writing to string never fails
        writeln!(
            error_lines,
            "Required dependency '{tool}' is not installed.",
        )?;

        writeln!(error_lines, "Resolve Error Info:{err}",)?;

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
        Some(err_text) => bail!("{}", err_text.trim()),
        None => Ok(()),
    }
}

/// Prints the information of the needed tools for the development if available, otherwise prints
/// error information to `stderr`
pub fn print_env_info() {
    for tool in DevTool::all() {
        println!("{tool} Info:");
        match tool.resolve_path() {
            Ok(cmd) => {
                if let Err(err) = Command::new(cmd).arg(tool.version_args()).status() {
                    eprintln!("Error while retrieving dependency's information: {err}");
                }
            }
            Err(err) => eprintln!("Error while resolving tool '{tool}': {err}"),
        }
        println!("------------------------------------------------------------------");
    }
}
