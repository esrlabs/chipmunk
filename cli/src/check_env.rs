use std::process::{Command, Stdio};

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
        "--help",
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
            let mut err_msg = format!("Required dependency '{}' is not installed.", check.app_name);
            if let Some(install_hint) = check.install_hint {
                err_msg.push_str(
                    format!("\nConsider installing it using the command '{install_hint}'").as_str(),
                );
            }
            bail!(err_msg);
        }
    }

    Ok(())
}
