use std::sync::RwLock;

use crate::{
    events::{ComputationError, NativeError, NativeErrorKind},
    progress::Severity,
    unbound::signal::Signal,
};
use plugins_host::plugins_manager::{self, PluginsManager};

use super::CommandOutcome;

/// Initialize the plugin manager loading all the plugins from their directory.
pub fn load_manager() -> Result<PluginsManager, ComputationError> {
    PluginsManager::load().map_err(|err| ComputationError::NativeError(err.into()))
}

/// Get all the read plugins (valid and invalid)
pub fn get_all_plugins(
    plugins_manager: &RwLock<PluginsManager>,
    _signal: Signal,
) -> Result<CommandOutcome<String>, ComputationError> {
    let manager = plugins_manager
        .read()
        .map_err(|_| poison_plugins_manager_error())?;

    let plugins = serde_json::to_string(manager.all_plugins()).map_err(|err| {
        ComputationError::Process(format!("Serializing data to json failed. Error: {err}"))
    })?;

    Ok(CommandOutcome::Finished(plugins))
}

/// Get all valid plugins only.
pub fn get_active_plugins(
    plugins_manager: &RwLock<PluginsManager>,
    _signal: Signal,
) -> Result<CommandOutcome<String>, ComputationError> {
    let manager = plugins_manager
        .read()
        .map_err(|_| poison_plugins_manager_error())?;

    let active_plugins: Vec<_> = manager.active_plugins().collect();

    let plugins = serde_json::to_string(&active_plugins).map_err(|err| {
        ComputationError::Process(format!("Serializing data to json failed. Error: {err}"))
    })?;

    Ok(CommandOutcome::Finished(plugins))
}

/// Reload plugins from the plugins directory.
pub fn reload_plugins(
    plugins_manager: &RwLock<PluginsManager>,
    _signal: Signal,
) -> Result<CommandOutcome<()>, ComputationError> {
    let mut manager = plugins_manager
        .write()
        .map_err(|_| poison_plugins_manager_error())?;

    manager
        .reload()
        .map_err(|err| ComputationError::NativeError(err.into()))?;

    Ok(CommandOutcome::Finished(()))
}

fn poison_plugins_manager_error() -> ComputationError {
    ComputationError::Communication(String::from("Failed to get access to plugins manager"))
}

impl From<plugins_manager::InitError> for NativeError {
    fn from(err: plugins_manager::InitError) -> Self {
        Self {
            severity: Severity::ERROR,
            kind: NativeErrorKind::Plugins,
            message: Some(err.to_string()),
        }
    }
}
