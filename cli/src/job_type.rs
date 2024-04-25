#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum JobType {
    _Environment,
    Lint,
    Build { production: bool },
    Clean { production: bool },
    Test { production: bool },
    Run { production: bool },
}

impl JobType {
    pub fn is_production(&self) -> Option<bool> {
        match self {
            JobType::_Environment | JobType::Lint => None,
            JobType::Build { production }
            | JobType::Clean { production }
            | JobType::Test { production }
            | JobType::Run { production } => Some(*production),
        }
    }
}
