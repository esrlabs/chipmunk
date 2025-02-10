use std::str::FromStr;

use crate::*;

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
