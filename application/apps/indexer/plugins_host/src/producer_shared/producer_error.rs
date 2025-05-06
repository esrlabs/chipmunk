use thiserror::Error;

#[derive(Debug, Error)]
/// Error reported from producer plugin.
pub enum PluginProduceError {
    #[error("Unrecoverable error: {0}")]
    /// Unrecoverable error indicating that the plugin in an unrecoverable state.
    Unrecoverable(String),
    #[error("Produce error: {0}")]
    /// Error while producing log results.
    Produce(String),
    /// Errors not included in the other error types.
    #[error("Error: {0}")]
    Other(String),
}
