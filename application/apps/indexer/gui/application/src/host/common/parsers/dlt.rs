use enum_iterator::Sequence;
use std::{fmt::Display, path::PathBuf};

/// DLT Configurations to be used in front-end
#[derive(Debug, Clone)]
pub struct DltParserConfig {
    pub with_storage_header: bool,
    pub log_level: DltLogLevel,
    pub fibex_file_paths: Vec<PathBuf>,
    pub timezone: Option<String>,
}

impl DltParserConfig {
    pub fn new(with_storage_header: bool) -> Self {
        Self {
            with_storage_header,
            log_level: DltLogLevel::Verbose,
            fibex_file_paths: Vec::new(),
            timezone: None,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, PartialOrd, Ord, Eq, Sequence)]
pub enum DltLogLevel {
    Fatal = 1,
    Error = 2,
    Warn = 3,
    Info = 4,
    Debug = 5,
    Verbose = 6,
}

impl DltLogLevel {
    pub const fn all() -> &'static [Self] {
        // Reminder to update on new types
        match DltLogLevel::Fatal {
            DltLogLevel::Fatal => {}
            DltLogLevel::Error => {}
            DltLogLevel::Warn => {}
            DltLogLevel::Info => {}
            DltLogLevel::Debug => {}
            DltLogLevel::Verbose => {}
        };

        &[
            DltLogLevel::Fatal,
            DltLogLevel::Error,
            DltLogLevel::Warn,
            DltLogLevel::Info,
            DltLogLevel::Debug,
            DltLogLevel::Verbose,
        ]
    }
}

impl Display for DltLogLevel {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let name = match self {
            DltLogLevel::Fatal => "Fatal",
            DltLogLevel::Error => "Error",
            DltLogLevel::Warn => "Warn",
            DltLogLevel::Info => "Info",
            DltLogLevel::Debug => "Debug",
            DltLogLevel::Verbose => "Verbose",
        };

        f.write_str(name)
    }
}
