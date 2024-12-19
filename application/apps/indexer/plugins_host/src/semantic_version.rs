use std::{
    fmt::{self, Display},
    str::FromStr,
};

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
pub struct SemanticVersion {
    pub major: u16,
    pub minor: u16,
    pub patch: u16,
}

//TODO AAZ: Remove when used.
#[allow(unused)]
impl SemanticVersion {
    /// Creates a new [`SemanticVersion`]
    pub fn new(major: u16, minor: u16, patch: u16) -> Self {
        Self {
            major,
            minor,
            patch,
        }
    }

    /// Returns the major version number.
    #[inline]
    pub fn major(&self) -> u16 {
        self.major
    }

    /// Returns the minor version number.
    #[inline]
    pub fn minor(&self) -> u16 {
        self.minor
    }

    /// Returns the patch version number.
    #[inline]
    pub fn patch(&self) -> u16 {
        self.patch
    }
}

impl Display for SemanticVersion {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}.{}.{}", self.major, self.minor, self.patch)
    }
}

impl FromStr for SemanticVersion {
    type Err = anyhow::Error;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        let parts: Vec<_> = s.split('.').collect();

        anyhow::ensure!(
            parts.len() == 3,
            "Input schema doesn't match semver schema '{{major}}.{{minor}}.{{path}}'"
        );

        let major = parts[0].parse()?;
        let minor = parts[1].parse()?;
        let patch = parts[2].parse()?;

        Ok(Self {
            major,
            minor,
            patch,
        })
    }
}
