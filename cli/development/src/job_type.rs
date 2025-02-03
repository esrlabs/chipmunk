//! Provides the definitions of job types (build, lint ...) and their relations.

use std::fmt::Display;

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
// * NOTE: The order of job types must match the running-order of them because it's used by
// solving their dependencies-graph using BTreeMap
//
// * NOTE: We provide all job types in match arms without using wild-card matching nor
// `matches!()` macro to keep the compiler assistance when adding new job types.
pub enum JobType {
    Clean,
    Install { production: bool },
    Build { production: bool },
    AfterBuild { production: bool },
    Lint,
    Test { production: bool },
    Run { production: bool },
}

impl Display for JobType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            JobType::Lint => write!(f, "Lint"),
            JobType::Clean => write!(f, "Clean"),
            JobType::Build { .. } => write!(f, "Build"),
            JobType::Install { .. } => write!(f, "Install"),
            JobType::AfterBuild { .. } => write!(f, "After Build"),
            JobType::Test { .. } => write!(f, "Test"),
            JobType::Run { .. } => write!(f, "Run"),
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
            // Linting TS needs to building too to check for type errors
            JobType::Lint => vec![JobType::Build { production: false }],
            JobType::Build { production } => vec![
                JobType::Install {
                    production: *production,
                },
                JobType::AfterBuild {
                    production: *production,
                },
            ],
            // Only TS and WASM Tests need to build before running the tests
            JobType::Run { production } | JobType::Test { production } => vec![JobType::Build {
                production: *production,
            }],
            JobType::Clean | JobType::Install { .. } | JobType::AfterBuild { .. } => Vec::new(),
        }
    }

    /// Returns if the job type is related to the build process. (install, build, or after build)
    pub fn is_build_related(&self) -> bool {
        match self {
            JobType::Install { .. } | JobType::Build { .. } | JobType::AfterBuild { .. } => true,
            JobType::Clean | JobType::Lint | JobType::Test { .. } | JobType::Run { .. } => false,
        }
    }
}

#[cfg(test)]
impl JobType {
    /// Returns all existing targets with production set to false for the types with
    /// production infos
    pub fn all() -> &'static [JobType] {
        if cfg!(debug_assertions) {
            // This check to remember to add the newly added enums to this function
            match JobType::Lint {
                JobType::Lint => (),
                JobType::Clean => (),
                JobType::Build { .. } => (),
                JobType::Install { .. } => (),
                JobType::AfterBuild { .. } => (),
                JobType::Test { .. } => (),
                JobType::Run { .. } => (),
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
