use std::str::FromStr;

use dlt_core::dlt;

#[derive(Debug, Clone, Copy)]
pub enum LogLevel {
    Fatal,
    Error,
    Warn,
    Info,
    Debug,
    Verbose,
}

impl From<LogLevel> for dlt::LogLevel {
    fn from(value: LogLevel) -> Self {
        match value {
            LogLevel::Fatal => dlt::LogLevel::Fatal,
            LogLevel::Error => dlt::LogLevel::Error,
            LogLevel::Warn => dlt::LogLevel::Warn,
            LogLevel::Info => dlt::LogLevel::Info,
            LogLevel::Debug => dlt::LogLevel::Debug,
            LogLevel::Verbose => dlt::LogLevel::Verbose,
        }
    }
}

impl FromStr for LogLevel {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "Fatal" => Ok(Self::Fatal),
            "Error" => Ok(Self::Error),
            "Warn" => Ok(Self::Warn),
            "Info" => Ok(Self::Info),
            "Debug" => Ok(Self::Debug),
            "Verbose" => Ok(Self::Verbose),
            invalid => Err(format!("Invalid input: {invalid}")),
        }
    }
}

impl LogLevel {
    pub const fn to_str(self) -> &'static str {
        match self {
            LogLevel::Fatal => "Fatal",
            LogLevel::Error => "Error",
            LogLevel::Warn => "Warn",
            LogLevel::Info => "Info",
            LogLevel::Debug => "Debug",
            LogLevel::Verbose => "Verbose",
        }
    }
    pub const fn to_u8(self) -> u8 {
        match self {
            LogLevel::Fatal => 1,
            LogLevel::Error => 2,
            LogLevel::Warn => 3,
            LogLevel::Info => 4,
            LogLevel::Debug => 5,
            LogLevel::Verbose => 6,
        }
    }

    pub const fn all() -> &'static [Self] {
        &[
            LogLevel::Fatal,
            LogLevel::Error,
            LogLevel::Warn,
            LogLevel::Info,
            LogLevel::Debug,
            LogLevel::Verbose,
        ]
    }
}
