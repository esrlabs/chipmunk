use log::{Log, Metadata, Record};

/// Provides methods to send logs to the WASM host.
///
/// This trait is made to be used internally only and it is not part of the crate's public API
/// and is subject to change at any time.
pub trait LogSend {
    fn send_msg(&self, level: log::Level, msg: &str);
}

#[derive(Debug)]
/// Struct that implements [`log::Log`] trait to enable the users to use rust standard
/// log macros to send log messages to the host.
///
/// This struct is made for internal use only and it is not part of the crate's public API
/// and is subject to change at any time.
pub struct PluginLogger<C>
where
    C: LogSend,
{
    sender: C,
}

impl<C> PluginLogger<C>
where
    C: LogSend,
{
    pub const fn new(sender: C) -> Self {
        Self { sender }
    }
}

impl<C> Log for PluginLogger<C>
where
    C: LogSend + Send + Sync,
{
    fn enabled(&self, metadata: &Metadata) -> bool {
        metadata.level() <= log::max_level().to_level().unwrap_or(log::Level::Error)
    }

    fn log(&self, record: &Record) {
        if !self.enabled(record.metadata()) {
            return;
        }

        if let Some(msg) = record.args().as_str() {
            self.sender.send_msg(record.level(), msg);
        } else {
            let msg = record.args().to_string();
            self.sender.send_msg(record.level(), msg.as_str());
        };
    }

    fn flush(&self) {
        // we don't need to flush here because we are sending the messages to the host directly.
    }
}

#[cfg(test)]
mod tests {
    use std::{cell::Cell, sync::Mutex};

    use super::*;
    use log::LevelFilter;

    #[derive(Default)]
    /// Keeps track if a message has been sent and provide methods to reset the tracker.
    /// This implementation isn't thread safe.
    struct TrackSender {
        sent: Mutex<Cell<bool>>,
    }

    impl TrackSender {
        fn reset(&self) {
            let sent = self.sent.lock().unwrap();
            sent.set(false);
        }

        fn is_sent(&self) -> bool {
            let sent = self.sent.lock().unwrap();
            sent.get()
        }
    }

    impl LogSend for TrackSender {
        fn send_msg(&self, _level: log::Level, _msg: &str) {
            // set sent to true and ignore sending the message
            let sent = self.sent.lock().unwrap();
            sent.set(true);
        }
    }

    static LOGGER: PluginLogger<TrackSender> = PluginLogger::new(TrackSender {
        sent: Mutex::new(Cell::new(false)),
    });

    #[test]
    fn test_plugin_logger() {
        log::set_logger(&LOGGER).unwrap();

        // Debug Message on Warn Level.
        log::set_max_level(LevelFilter::Warn);
        log::debug!("");
        assert!(
            !LOGGER.sender.is_sent(),
            "Debug Message on Warn Level can't be sent"
        );
        LOGGER.sender.reset();

        // Warn Message on Debug Level
        log::set_max_level(LevelFilter::Debug);
        log::warn!("");
        assert!(
            LOGGER.sender.is_sent(),
            "Warn Message on Debug Level should be sent"
        );
        LOGGER.sender.reset();

        // Warn message on Warn Level
        log::set_max_level(LevelFilter::Warn);
        log::warn!("");
        assert!(
            LOGGER.sender.is_sent(),
            "Warn Message on Warn Level should be sent"
        );
        LOGGER.sender.reset();
    }
}
