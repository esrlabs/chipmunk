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
