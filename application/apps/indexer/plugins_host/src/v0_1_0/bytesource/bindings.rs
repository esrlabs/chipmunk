use std::io;

use sources::plugins::{ByteSourceInput, PluginByteSourceGeneralSettings};

use crate::PluginGuestInitError;

pub use self::chipmunk::plugin::{bytesource_types, shared_types};

wasmtime::component::bindgen!({
    path: "../plugins_api/wit/v_0.1.0/",
    world: "bytesource-plugin",
    async: {
        only_imports: [],
    },
});

impl From<&PluginByteSourceGeneralSettings> for bytesource_types::SourceConfig {
    fn from(_value: &PluginByteSourceGeneralSettings) -> Self {
        // We must use the current log level form chipmunk because we are using the same log
        // functionality to log the message from the plugins.
        let current_log_level = log::max_level().to_level().unwrap_or(log::Level::Error);

        use chipmunk::plugin::logging::Level as PlugLevel;
        let level = match current_log_level {
            log::Level::Error => PlugLevel::Error,
            log::Level::Warn => PlugLevel::Warn,
            log::Level::Info => PlugLevel::Info,
            log::Level::Debug => PlugLevel::Debug,
            log::Level::Trace => PlugLevel::Trace,
        };

        Self { log_level: level }
    }
}

impl From<shared_types::InitError> for PluginGuestInitError {
    fn from(value: shared_types::InitError) -> Self {
        use shared_types::InitError as E;
        use PluginGuestInitError as GuestE;
        match value {
            E::Config(msg) => GuestE::Config(msg),
            E::Io(msg) => GuestE::IO(msg),
            E::Unsupported(msg) => GuestE::Unsupported(msg),
            E::Other(msg) => GuestE::Other(msg),
        }
    }
}

impl From<bytesource_types::SourceError> for io::Error {
    fn from(value: bytesource_types::SourceError) -> Self {
        use bytesource_types::SourceError as E;
        let msg = match value {
            E::Io(msg) => format!("IO Error from bytesoruce plugin. Error: {msg}"),
            E::Unsupported => String::from("Unsupported Error from bytesource plugin"),
            E::Other(msg) => format!("Unknown Error from bytesoruce plugin. Error: {msg}"),
        };

        io::Error::new(io::ErrorKind::Other, msg)
    }
}

impl From<ByteSourceInput> for bytesource_types::InputSource {
    fn from(value: ByteSourceInput) -> Self {
        use bytesource_types::InputSource as I;
        match value {
            ByteSourceInput::File(path) => I::File(path.to_string_lossy().to_string()),
            ByteSourceInput::Socket { ip, port } => {
                let socket_info = bytesource_types::SocketInfo { ip, port };
                I::Socket(socket_info)
            }
            ByteSourceInput::Url(url) => I::Url(url),
            ByteSourceInput::DbConnectionString(db) => I::DbConncectoinString(db),
            ByteSourceInput::Memory(bytes) => I::Memory(bytes),
            ByteSourceInput::Other(input) => I::Other(input),
        }
    }
}
