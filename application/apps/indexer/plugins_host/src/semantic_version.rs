use std::{
    fmt::{self, Display},
    str::FromStr,
};

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub struct SemanticVersion {
    pub major: usize,
    pub minor: usize,
    pub patch: usize,
}

impl SemanticVersion {
    /// Creates a new [`SemanticVersion`]
    pub fn new(major: usize, minor: usize, patch: usize) -> Self {
        Self {
            major,
            minor,
            patch,
        }
    }

    /// Returns the major version number.
    #[inline]
    pub fn major(&self) -> usize {
        self.major
    }

    /// Returns the minor version number.
    #[inline]
    pub fn minor(&self) -> usize {
        self.minor
    }

    /// Returns the patch version number.
    #[inline]
    pub fn patch(&self) -> usize {
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
