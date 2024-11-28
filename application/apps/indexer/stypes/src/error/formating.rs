use crate::*;

impl std::fmt::Display for Severity {
    fn fmt(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result {
        write!(
            f,
            "{}",
            match self {
                Self::WARNING => "WARNING",
                Self::ERROR => "ERROR",
            }
        )
    }
}
