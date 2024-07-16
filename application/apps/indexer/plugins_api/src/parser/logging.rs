use crate::plugin_logger::LogSend;

use super::Level as WitLogLevel;
use super::__internal_bindings::chipmunk::plugin::logging::log;

use log::Level as LogLevel;

impl From<WitLogLevel> for LogLevel {
    fn from(value: WitLogLevel) -> Self {
        match value {
            WitLogLevel::Error => LogLevel::Error,
            WitLogLevel::Warn => LogLevel::Warn,
            WitLogLevel::Info => LogLevel::Info,
            WitLogLevel::Debug => LogLevel::Debug,
            WitLogLevel::Trace => LogLevel::Trace,
        }
    }
}

impl From<LogLevel> for WitLogLevel {
    fn from(value: LogLevel) -> Self {
        match value {
            LogLevel::Error => WitLogLevel::Error,
            LogLevel::Warn => WitLogLevel::Warn,
            LogLevel::Info => WitLogLevel::Info,
            LogLevel::Debug => WitLogLevel::Debug,
            LogLevel::Trace => WitLogLevel::Trace,
        }
    }
}

/// Provides method to send the log messages to WASM host for parser plugin.
///
/// This struct is made for internal use only and it is not part of the crate's public API
/// and is subject to change at any time.
pub struct ParserLogSend;

impl LogSend for ParserLogSend {
    fn send_msg(&self, level: log::Level, msg: &str) {
        log(level.into(), msg);
    }
}
