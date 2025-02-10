use crate::unbound::signal::Signal;
use plugins_host::plugins_manager::PluginsManager;
use stypes::{CommandOutcome, ComputationError, PluginsList};
use tokio::sync::RwLock;

/// Initialize the plugin manager loading all the plugins from their directory.
pub async fn load_manager() -> Result<PluginsManager, ComputationError> {
    PluginsManager::load()
        .await
        .map_err(|err| ComputationError::NativeError(err.into()))
}

/// Get all the read plugins (valid and invalid)
pub async fn get_all_plugins(
    plugins_manager: &RwLock<PluginsManager>,
    _signal: Signal,
) -> Result<CommandOutcome<PluginsList>, ComputationError> {
    let manager = plugins_manager.read().await;

    let plugins = PluginsList(manager.all_plugins().to_vec());

    Ok(CommandOutcome::Finished(plugins))
}

/// Get all valid plugins only.
pub async fn get_active_plugins(
    plugins_manager: &RwLock<PluginsManager>,
    _signal: Signal,
) -> Result<CommandOutcome<PluginsList>, ComputationError> {
    let manager = plugins_manager.read().await;

    let active_plugins: Vec<_> = manager.active_plugins().cloned().collect();

    let plugins = PluginsList(active_plugins);

    Ok(CommandOutcome::Finished(plugins))
}

/// Reload plugins from the plugins directory.
pub async fn reload_plugins(
    plugins_manager: &RwLock<PluginsManager>,
    _signal: Signal,
) -> Result<CommandOutcome<()>, ComputationError> {
    let mut manager = plugins_manager.write().await;

    manager
        .reload()
        .await
        .map_err(|err| ComputationError::NativeError(err.into()))?;

    Ok(CommandOutcome::Finished(()))
}
