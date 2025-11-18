use std::fmt;

#[derive(Debug)]
pub enum McpError {
    Generic { message: String },
    ApplyFilter { message: String },
}

impl fmt::Display for McpError {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        match self {
            McpError::Generic { message } => write!(f, "{}", message),
            McpError::ApplyFilter { message } => write!(f, "{}", message),
        }
    }
}

impl std::error::Error for McpError {}
