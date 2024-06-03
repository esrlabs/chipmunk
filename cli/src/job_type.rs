use std::fmt::Display;

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
//NOTE: The order of job types must match the runnig-order of them because it's used by
// solving their dependencies-graph using BTreeMap
pub enum JobType {
    Lint,
    Clean,
    Install { production: bool },
    Build { production: bool },
    AfterBuild { production: bool },
    Test { production: bool },
    Run { production: bool },
}

impl Display for JobType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            JobType::Lint => write!(f, "Lint"),
            JobType::Clean => write!(f, "Clean"),
            JobType::Build { production: _ } => write!(f, "Build"),
            JobType::Install { production: _ } => write!(f, "Install"),
            JobType::AfterBuild { production: _ } => write!(f, "After Bulid"),
            JobType::Test { production: _ } => write!(f, "Test"),
            JobType::Run { production: _ } => write!(f, "Run"),
        }
    }
}

impl JobType {
    pub fn is_production(&self) -> Option<bool> {
        match self {
            JobType::Lint | JobType::Clean => None,
            JobType::Build { production }
            | JobType::Install { production }
            | JobType::AfterBuild { production }
            | JobType::Test { production }
            | JobType::Run { production } => Some(*production),
        }
    }

    /// Returns job types that are involved with this job and should run with it.
    pub fn get_involved_jobs(&self) -> Vec<JobType> {
        match self {
            JobType::Lint => vec![JobType::Install { production: false }],
            JobType::Build { production } => vec![
                JobType::Install {
                    production: *production,
                },
                JobType::AfterBuild {
                    production: *production,
                },
            ],
            JobType::Run { production } | JobType::Test { production } => vec![JobType::Build {
                production: *production,
            }],
            JobType::Clean
            | JobType::Install { production: _ }
            | JobType::AfterBuild { production: _ } => Vec::new(),
        }
    }

    /// Returns if the job type is part of the build process (install, build, or after build)
    pub fn is_part_of_build(&self) -> bool {
        matches!(
            self,
            JobType::Install { production: _ }
                | JobType::Build { production: _ }
                | JobType::AfterBuild { production: _ }
        )
    }
}

#[cfg(test)]
impl JobType {
    pub fn all() -> &'static [JobType] {
        if cfg!(debug_assertions) {
            // This check to remember to add the newly added enums to this function
            match JobType::Lint {
                JobType::Lint => (),
                JobType::Clean => (),
                JobType::Build { production: _ } => (),
                JobType::Install { production: _ } => (),
                JobType::AfterBuild { production: _ } => (),
                JobType::Test { production: _ } => (),
                JobType::Run { production: _ } => (),
            };
        }

        [
            JobType::Lint,
            JobType::Clean,
            JobType::Build { production: false },
            JobType::Install { production: false },
            JobType::AfterBuild { production: false },
            JobType::Test { production: false },
            JobType::Run { production: false },
        ]
        .as_slice()
    }
}