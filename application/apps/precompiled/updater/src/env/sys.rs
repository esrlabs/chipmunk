use anyhow::{Result, *};
use std::{
    path::PathBuf,
    process::{Child, Command},
    result::Result::Ok,
};
use toml::Value;

fn spawn(exe: &str, args: &[&str]) -> Result<Child> {
    Command::new(exe)
        .args(args)
        .spawn()
        .map_err(|e| anyhow!("could not spawn {} as a process ({})", exe, e))
}

pub fn start(app: PathBuf) -> Result<()> {
    let to_be_started: PathBuf = if cfg!(target_os = "macos") {
        app.join("Contents/MacOS/chipmunk")
    } else {
        app
    };
    log::debug!("restarting app: {:?}", to_be_started);
    if !to_be_started.exists() {
        Err(anyhow!("Failed to restart, couldn't find executable file"))
    } else {
        log::debug!("Starting: {:?}", &to_be_started);
        spawn(
            to_be_started
                .to_str()
                .expect("process for starting could not be spawned"),
            &[],
        )
        .map_err(|e| anyhow!("Fail to start app due error: {}", e))
        .map(|_| ())
    }
}

pub fn version() -> String {
    let cargo_toml = std::include_str!("../../Cargo.toml");
    let defaults = String::from("not_found");
    if let Ok(value) = cargo_toml.parse::<Value>() {
        let as_table = if let Some(as_table) = value.as_table() {
            as_table
        } else {
            return defaults;
        };
        let package = if let Some(package) = as_table.get("package") {
            package
        } else {
            return defaults;
        };
        let as_table = if let Some(as_table) = package.as_table() {
            as_table
        } else {
            return defaults;
        };
        let version = if let Some(version) = as_table.get("version") {
            version
        } else {
            return defaults;
        };
        if let Some(version) = version.as_str() {
            version.to_owned()
        } else {
            defaults
        }
    } else {
        String::from("unknown")
    }
}
