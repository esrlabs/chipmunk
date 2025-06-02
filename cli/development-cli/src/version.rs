//! Manages Comparing the current version of the binary to the version of this CLI tool from the
//! current local repository of the user, printing a message to the user on newer editions.

use std::{cmp::Ordering, fmt::Display, str::FromStr, sync::LazyLock};

use anyhow::{Context, ensure};
use console::style;
use regex::Regex;
use serde::Deserialize;
use toml::Value;

use crate::target::Target;

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Deserialize)]
/// Represents a semantic Version with major, minor, patch parts
pub struct Version {
    pub major: usize,
    pub minor: usize,
    pub patch: usize,
}

impl Version {
    /// Creates a new instance with the provided arguments.
    pub fn new(major: usize, minor: usize, patch: usize) -> Self {
        Self {
            major,
            minor,
            patch,
        }
    }

    /// Tries to extract the semantic version from text using regex.
    ///
    /// # Examples
    ///
    /// ```rust
    /// let version = Version::regex_extract("Some text v11.2.111:ignored_infos").unwrap();
    /// assert_eq!(version, Version(11, 2, 111));
    /// ```
    pub fn regex_extract(text: &str) -> anyhow::Result<Self> {
        static RE: LazyLock<Regex> = LazyLock::new(|| {
            Regex::new(r"(?P<major>0|[1-9]\d*)\.(?P<minor>0|[1-9]\d*)\.(?P<patch>0|[1-9]\d*)")
                .expect("Regex with const expression must be always valid")
        });

        let caps = RE
            .captures(text)
            .context("No text version found in provided text")?;

        let major = caps.name("major").context("Major version not found")?;
        let minor = caps.name("minor").context("Minor version not found")?;
        let patch = caps.name("patch").context("Patch version not found")?;

        let major = major
            .as_str()
            .parse()
            .context("Parsing major version failed")?;
        let minor = minor
            .as_str()
            .parse()
            .context("Parsing minor version failed")?;
        let patch = patch
            .as_str()
            .parse()
            .context("Parsing patch version failed")?;

        Ok(Self::new(major, minor, patch))
    }
}

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

        Ok(Version::new(major, minor, patch))
    }
}

impl Display for Version {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}.{}.{}", self.major, self.minor, self.patch)
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
            let info_msg = format!(
                "The version of the installed Build CLI Tool is more recent than the current one in the local repository\n\
                Installed Version: {bin_version}\n\
                Local repo Version: {repo_version}\n"
            );
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
    use Version as V;
    use pretty_assertions::assert_eq;

    #[test]
    fn version_ord() {
        assert!(V::new(1, 1, 1) > V::new(1, 1, 0));
        assert!(V::new(1, 0, 1) < V::new(1, 1, 0));
        assert!(V::new(2, 0, 1) > V::new(1, 1, 0));
        assert!(V::new(0, 0, 1) < V::new(1, 1, 0));
        assert!(V::new(0, 0, 2) > V::new(0, 0, 1));
        assert!(V::new(0, 1, 0) > V::new(0, 0, 1));
        assert!(V::new(0, 2, 0) > V::new(0, 1, 9));
        assert!(V::new(1, 0, 0) > V::new(0, 9, 9));
    }

    #[test]
    fn version_parse() {
        assert_eq!(V::from_str("1.2.3").unwrap(), V::new(1, 2, 3));

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

    #[test]
    fn version_regex_valid() {
        let ver = Version::regex_extract("10.20.30").unwrap();
        assert_eq!(Version::new(10, 20, 30), ver);

        let ver = Version::regex_extract("0.2.111").unwrap();
        assert_eq!(Version::new(0, 2, 111), ver);

        let ver = Version::regex_extract("v0.2.111").unwrap();
        assert_eq!(Version::new(0, 2, 111), ver);

        let ver = Version::regex_extract("v11.2.111").unwrap();
        assert_eq!(Version::new(11, 2, 111), ver);

        let ver = Version::regex_extract("Some text 1.2.0").unwrap();
        assert_eq!(Version::new(1, 2, 0), ver);

        let ver = Version::regex_extract("Some text v1.2.0").unwrap();
        assert_eq!(Version::new(1, 2, 0), ver);

        let ver = Version::regex_extract("1.2.0 text after").unwrap();
        assert_eq!(Version::new(1, 2, 0), ver);

        let ver = Version::regex_extract("v0.2.355 text after").unwrap();
        assert_eq!(Version::new(0, 2, 355), ver);

        let ver = Version::regex_extract("1.2.12:pre-release").unwrap();
        assert_eq!(Version::new(1, 2, 12), ver);
    }

    #[test]
    fn version_regex_invalid() {
        let invalid_patterns = [
            "", "   ", "0.1", "0.01.2", "234", "owieurw", "aa.bb.cc", "a.b.c", "v01.2.", "1 .2.3",
        ];
        for invalid in invalid_patterns {
            assert!(
                Version::regex_extract(invalid).is_err(),
                "pattern '{invalid}' must be invalid"
            );
        }
    }
}
