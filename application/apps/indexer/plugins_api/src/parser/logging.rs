use super::Level as LogLevel;
use super::__internal_bindings::chipmunk::plugin::logging::log;

impl LogLevel {
    const fn get_num(&self) -> usize {
        match self {
            LogLevel::Error => 1,
            LogLevel::Warning => 2,
            LogLevel::Info => 3,
            LogLevel::Debug => 4,
            LogLevel::Trace => 5,
        }
    }
}

static mut LOG_LEVEL: LogLevel = LogLevel::Warning;

/// Gets Current log level in the plugin world.
/// Log level will be set once by plugin initialization and can't be changed after that.
pub fn current_log_level() -> LogLevel {
    // SAFETY: log level will be set once on plugin initialization.
    unsafe { LOG_LEVEL }
}

/// Sets current log level in the plugin world.
/// SAFETY: This method changes a mutable static variable and should be called once while plugin
/// initialization
pub(crate) unsafe fn set_log_level(level: LogLevel) {
    LOG_LEVEL = level;
}

#[inline]
fn can_log(level: LogLevel) {
    level.get_num() <= unsafe { LOG_LEVEL.get_num() }
}

pub fn log_msg(level: LogLevel, msg: impl Into<&str>) {
    if !can_log(level) {
        return;
    }

    log(level, msg.into());
}

pub fn log_error(msg: impl Into<&str>) {
    log_msg(LogLevel::Error, msg);
}

pub fn log_warning(msg: impl Into<&str>) {
    log_msg(LogLevel::Warning, msg);
}

pub fn log_info(msg: impl Into<&str>) {
    log_msg(LogLevel::Info, msg);
}

pub fn log_debug(msg: impl Into<&str>) {
    log_msg(LogLevel::Debug, msg);
}

pub fn log_trace(msg: impl Into<&str>) {
    log_msg(LogLevel::Trace, msg);
}
