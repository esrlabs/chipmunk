use std::{
    fmt::Write,
    process::{Command, Stdio},
};

use anyhow::bail;

const ENV_CHECKS: [EnvCheck; 7] = [
    EnvCheck::new("NodeJS", "node", "-v", None),
    EnvCheck::new("npm", "npm", "-v", None),
    EnvCheck::new("yarn", "yarn", "-v", Some("npm install --global yarn")),
    EnvCheck::new("rust", "rustup", "-V", None),
    EnvCheck::new("cargo", "cargo", "-V", None),
    EnvCheck::new(
        "wasm-pack",
        "wasm-pack",
        "-V",
        Some("cargo install wasm-pack"),
    ),
    EnvCheck::new("nj-cli", "nj-cli", "-V", Some("cargo install nj-cli")),
];

struct EnvCheck {
    app_name: &'static str,
    command: &'static str,
    arg: &'static str,
    install_hint: Option<&'static str>,
}

impl EnvCheck {
    const fn new(
        app_name: &'static str,
        command: &'static str,
        arg: &'static str,
        install_hint: Option<&'static str>,
    ) -> Self {
        Self {
            app_name,
            command,
            arg,
            install_hint,
        }
    }
}

/// Checks if all the needed dependencies for the build environment are available
pub fn check_env() -> anyhow::Result<()> {
    let mut errors = None;
    for check in ENV_CHECKS.iter() {
        let success = match Command::new(check.command)
            .arg(check.arg)
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status()
        {
            Ok(status) => status.success(),
            Err(_) => false,
        };

        if !success {
            let error_lines =
                errors.get_or_insert(String::from("Following dependencies are missing:\n"));
            writeln!(
                error_lines,
                "Required dependency '{}' is not installed.",
                check.app_name
            )
            .expect("Writing to string never fail");
            if let Some(install_hint) = check.install_hint {
                writeln!(
                    error_lines,
                    "Consider installing it using the command '{install_hint}'"
                )
                .expect("Writing to string never fail");
            }

            writeln!(
                error_lines,
                "------------------------------------------------------------------"
            )
            .expect("Writing to string never fail");
        }
    }

    match errors {
        Some(err_text) => bail!("{}", err_text.trim()),
        None => Ok(()),
    }
}

/// Prints the information of the needed tools for the development if available, otherwise prints
/// error information to `stderr`
pub fn print_env_info() {
    for check in ENV_CHECKS.iter() {
        println!("{} Info:", check.app_name);
        if let Err(err) = Command::new(check.command).arg(check.arg).status() {
            eprintln!("Error while retrieving dependency's information: {err}");
        }
        println!("------------------------------------------------------------------");
    }
}
