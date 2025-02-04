//! Manages Comparing the current version of the binary to the version of this CLI tool from the
//! current local repository of the user, printing a message to the user on newer editions.

use std::{cmp::Ordering, fmt::Display, str::FromStr};

use anyhow::{ensure, Context};
use console::style;
use toml::Value;

use crate::target::Target;

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
/// Represents a semantic Version with major, minor, patch parts
struct Version(usize, usize, usize);

impl FromStr for Version {
    type Err = anyhow::Error;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        let mut parts = s.split('.');
        const ERROR_MSG: &str = "String is invalid";

        let major = parts
            .next()
            .and_then(|m| m.parse().ok())
            .context(ERROR_MSG)?;
        let minor = parts
            .next()
            .and_then(|m| m.parse().ok())
            .context(ERROR_MSG)?;
        let patch = parts
            .next()
            .and_then(|m| m.parse().ok())
            .context(ERROR_MSG)?;

        Ok(Version(major, minor, patch))
    }
}

impl Display for Version {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}.{}.{}", self.0, self.1, self.2)
    }
}

/// Compares the version of this CLI tool of the version in `cargo.toml` in the
/// local repository, printing a warning if a newer version is available.
pub fn check_version() {
    if let Err(err) = try_check_version() {
        let msg = format!("Check for version of Build CLI Tool Failed.\nError: {err:?}\n");
        eprintln!("{}", style(msg).yellow());
    }
}

/// Reads and parses the version from the current local repo and compare it to version of the
/// current binary file, printing a message if a newer version is available.
fn try_check_version() -> anyhow::Result<()> {
    let bin_version = bin_version();
    let bin_version: Version = bin_version.parse().with_context(|| {
        format!("Parsing current binary version text failed. Version: {bin_version}")
    })?;
    let repo_version =
        version_in_repo().context("Parsing version of CLI from local repo failed")?;
    let repo_version: Version = repo_version.parse().with_context(|| {
        format!("Parsing local repo version text failed. Version: {repo_version}")
    })?;

    match repo_version.cmp(&bin_version) {
        Ordering::Less => {
            let info_msg = format!("The version of the installed Build CLI Tool is more recent than the current one in the local repository\n\
                Installed Version: {bin_version}\n\
                Local repo Version: {repo_version}\n");
            eprintln!("{}", style(info_msg).cyan());
        }
        Ordering::Equal => {}
        Ordering::Greater => {
            let warn_msg = format!(
                "A newer version of the Build CLI Tool is available in the local repository\n\
                Installed Version: {bin_version}\n\
                Local repo Version: {repo_version}\n"
            );
            eprintln!("{}", style(warn_msg).yellow());
        }
    }

    Ok(())
}

/// Returns the version of current binary.
fn bin_version() -> &'static str {
    env!("CARGO_PKG_VERSION")
}

/// Reads `cargo.toml` of build CLI tool in the local repo, returning the current version of
/// the app from it.
fn version_in_repo() -> anyhow::Result<String> {
    let cargo_path = Target::CliDev.cwd().join("Cargo.toml");
    ensure!(
        cargo_path.exists(),
        "Cargo file for build_cli doesn't exit. Path: {}",
        cargo_path.display()
    );

    let cargo_content = std::fs::read_to_string(&cargo_path).with_context(|| {
        format!(
            "Reading CLI Cargo file failed. Path {}",
            cargo_path.display()
        )
    })?;

    let cargo_toml: Value = cargo_content.parse().with_context(|| {
        format!(
            "Parsing the content of CLI cargo file failed. Path: {}",
            cargo_path.display()
        )
    })?;

    let version = cargo_toml
        .get("package")
        .and_then(|pkg| pkg.get("version"))
        .and_then(|v| match v {
            Value::String(s) => Some(s.to_owned()),
            _ => None,
        })
        .context("Failed to parse app version from CLI cargo.toml file")?;

    Ok(version)
}

#[cfg(test)]
mod tests {
    use super::*;
    use pretty_assertions::assert_eq;
    use Version as V;

    #[test]
    fn version_ord() {
        assert!(V(1, 1, 1) > V(1, 1, 0));
        assert!(V(1, 0, 1) < V(1, 1, 0));
        assert!(V(2, 0, 1) > V(1, 1, 0));
        assert!(V(0, 0, 1) < V(1, 1, 0));
    }

    #[test]
    fn version_parse() {
        assert_eq!(V::from_str("1.2.3").unwrap(), V(1, 2, 3));

        assert!(V::from_str("1.2").is_err());
        assert!(V::from_str("1111").is_err());
        assert!(V::from_str("").is_err());
        assert!(V::from_str("one.two.three").is_err());
    }

    #[test]
    fn version_ord_str() {
        let ver1: V = "1.2.3".parse().unwrap();
        let ver2: V = "0.4.5".parse().unwrap();
        assert!(ver1 > ver2);

        let ver3: V = "2.0.0".parse().unwrap();
        assert!(ver3 > ver1);
        assert!(ver3 > ver2);
    }
}
