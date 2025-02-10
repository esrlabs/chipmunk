use std::io;

pub use self::chipmunk::bytesource::bytesource_types;

wasmtime::component::bindgen!({
    path: "../plugins_api/wit/v0.1.0",
    world: "chipmunk:bytesource/bytesource",
    // Activate async but shrink its interfaces as possible.
    // Without activating async, wasmtime will spawn new runtime on its own,
    // causing the app to panic because the app already have its own tokio runtime.
    async: {
        only_imports: [],
    },
    // Link shared types to avoid regenerating them.
    with: {
        "chipmunk:shared/logging@0.1.0": crate::v0_1_0::shared::logging,
        "chipmunk:shared/shared-types@0.1.0": crate::v0_1_0::shared::shared_types,
    }
});

impl From<&stypes::PluginByteSourceGeneralSettings> for bytesource_types::SourceConfig {
    fn from(_value: &stypes::PluginByteSourceGeneralSettings) -> Self {
        // We must use the current log level form chipmunk because we are using the same log
        // functionality to log the message from the plugins.
        let current_log_level = log::max_level().to_level().unwrap_or(log::Level::Error);

        use crate::v0_1_0::shared::logging::Level as PlugLevel;
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

impl From<bytesource_types::SourceError> for io::Error {
    fn from(value: bytesource_types::SourceError) -> Self {
        use bytesource_types::SourceError as E;
        let msg = match value {
            E::Io(msg) => format!("IO Error from bytesoruce plugin. Error: {msg}"),
            E::Unsupported(msg) => format!("Unsupported Error from bytesource plugin: {msg}"),
            E::Other(msg) => format!("Unknown Error from bytesoruce plugin. Error: {msg}"),
        };

        io::Error::new(io::ErrorKind::Other, msg)
    }
}
