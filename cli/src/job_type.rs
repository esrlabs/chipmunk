use std::fmt::Display;

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub enum JobType {
    Lint,
    Clean,
    Build { production: bool },
    Install { production: bool },
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
