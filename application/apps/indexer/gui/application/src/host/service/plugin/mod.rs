//! Backend plugin manager ownership for the native host service.
//!
//! This module keeps `PluginsManager` out of UI code and returns `PluginsState` values as
//! backend plugin lifecycle changes.

use std::{
    collections::HashMap,
    io,
    path::{Path, PathBuf},
};

use log::warn;
use plugins_host::plugins_manager::{PluginsManager, PluginsManagerError};
use tokio::sync::mpsc;

use crate::host::{
    message::PluginReadmeLoadResult,
    service::HostAsyncEvent,
    ui::state::plugin::{PluginsData, PluginsState},
};

const MAX_README_BYTES: u64 = 1024 * 1024;

/// Host-service owner for plugin manager lifecycle and operations.
#[derive(Debug)]
pub struct PluginService {
    runtime: PluginManagerRuntime,
    event_tx: mpsc::Sender<HostAsyncEvent>,
}

/// Backend plugin manager lifecycle inside the host service.
#[derive(Debug)]
enum PluginManagerRuntime {
    /// Initial loading is in progress.
    Loading,
    /// No manager is currently available.
    Unavailable,
    /// Plugin manager is loaded and can process plugin operations.
    Ready(Box<PluginsManager>),
}

/// Events emitted by plugin background tasks.
#[derive(Debug)]
pub enum PluginEvent {
    /// Initial or retry manager loading finished.
    LoadFinished(Result<Box<PluginsManager>, PluginsManagerError>),
}

impl PluginService {
    /// Initializes the plugin service and starts manager loading without blocking host startup.
    pub fn init(event_tx: mpsc::Sender<HostAsyncEvent>) -> Self {
        let service = Self {
            runtime: PluginManagerRuntime::Loading,
            event_tx,
        };

        service.spawn_load();

        service
    }

    /// Applies a plugin task event and returns updated UI plugin state.
    pub fn handle_event(
        &mut self,
        event: PluginEvent,
    ) -> Result<PluginsState, PluginsManagerError> {
        match event {
            PluginEvent::LoadFinished(result) => self.handle_load_result(result),
        }
    }

    /// Returns the current UI-facing plugin state.
    pub fn state(&self) -> PluginsState {
        match &self.runtime {
            PluginManagerRuntime::Loading => PluginsState::Loading,
            PluginManagerRuntime::Unavailable => PluginsState::Unavailable,
            PluginManagerRuntime::Ready(manager) => PluginsState::Available(plugins_data(manager)),
        }
    }

    /// Reloads loaded plugins and returns updated UI plugin state.
    pub async fn reload(&mut self) -> Result<PluginsState, PluginsManagerError> {
        match std::mem::replace(&mut self.runtime, PluginManagerRuntime::Loading) {
            PluginManagerRuntime::Loading => {
                self.runtime = PluginManagerRuntime::Loading;
                Err(manager_unavailable())
            }
            PluginManagerRuntime::Unavailable => {
                self.runtime = PluginManagerRuntime::Unavailable;
                Err(manager_unavailable())
            }
            PluginManagerRuntime::Ready(mut manager) => {
                if let Err(err) = manager.reload().await {
                    self.runtime = PluginManagerRuntime::Unavailable;
                    return Err(err);
                }

                let data = plugins_data(&manager);
                let state = PluginsState::Available(data);
                self.runtime = PluginManagerRuntime::Ready(manager);

                Ok(state)
            }
        }
    }

    /// Adds a plugin directory through the loaded plugin manager.
    pub async fn add(&mut self, path: PathBuf) -> Result<PluginsState, PluginsManagerError> {
        let PluginManagerRuntime::Ready(manager) = &mut self.runtime else {
            return Err(manager_unavailable());
        };

        manager.add_plugin(path, None).await?;

        let data = plugins_data(manager);

        Ok(PluginsState::Available(data))
    }

    /// Removes a plugin directory through the loaded plugin manager.
    pub async fn remove(&mut self, path: &Path) -> Result<PluginsState, PluginsManagerError> {
        let PluginManagerRuntime::Ready(manager) = &mut self.runtime else {
            return Err(manager_unavailable());
        };

        manager.remove_plugin(path).await?;

        let data = plugins_data(manager);

        Ok(PluginsState::Available(data))
    }

    /// Loads README markdown for an installed plugin.
    pub async fn load_readme(&self, plugin_path: &Path) -> PluginReadmeLoadResult {
        let readme_path = match &self.runtime {
            PluginManagerRuntime::Ready(manager) => manager
                .get_installed_plugin(plugin_path)
                .and_then(|plugin| plugin.readme_path.clone()),
            PluginManagerRuntime::Loading | PluginManagerRuntime::Unavailable => {
                return PluginReadmeLoadResult::Error(
                    "Plugins manager is not available.".to_owned(),
                );
            }
        };

        let Some(readme_path) = readme_path else {
            return PluginReadmeLoadResult::Missing;
        };

        let metadata = match tokio::fs::metadata(&readme_path).await {
            Ok(metadata) => metadata,
            Err(err) if err.kind() == io::ErrorKind::NotFound => {
                return PluginReadmeLoadResult::Missing;
            }
            Err(err) => {
                return PluginReadmeLoadResult::Error(format!(
                    "Failed to inspect README '{}': {err}",
                    readme_path.display()
                ));
            }
        };

        if !metadata.is_file() {
            return PluginReadmeLoadResult::Error(format!(
                "README path is not a file: {}",
                readme_path.display()
            ));
        }

        if metadata.len() > MAX_README_BYTES {
            return PluginReadmeLoadResult::Error(format!(
                "README file is larger than 1 MiB: {}",
                readme_path.display()
            ));
        }

        match tokio::fs::read_to_string(&readme_path).await {
            Ok(content) => PluginReadmeLoadResult::Loaded(content),
            Err(err) if err.kind() == io::ErrorKind::NotFound => PluginReadmeLoadResult::Missing,
            Err(err) => PluginReadmeLoadResult::Error(format!(
                "Failed to read README '{}': {err}",
                readme_path.display()
            )),
        }
    }

    fn spawn_load(&self) {
        let event_tx = self.event_tx.clone();

        tokio::spawn(async move {
            let result = PluginsManager::load().await.map(Box::new);

            if event_tx
                .send(HostAsyncEvent::Plugins(PluginEvent::LoadFinished(result)))
                .await
                .is_err()
            {
                warn!("Failed to send plugin manager load result");
            }
        });
    }

    fn handle_load_result(
        &mut self,
        result: Result<Box<PluginsManager>, PluginsManagerError>,
    ) -> Result<PluginsState, PluginsManagerError> {
        match result {
            Ok(manager) => {
                let state = PluginsState::Available(plugins_data(&manager));
                self.runtime = PluginManagerRuntime::Ready(manager);
                Ok(state)
            }
            Err(err) => {
                self.runtime = PluginManagerRuntime::Unavailable;
                Err(err)
            }
        }
    }
}

fn plugins_data(manager: &PluginsManager) -> PluginsData {
    let mut run_data = HashMap::new();

    let mut installed = Vec::with_capacity(manager.extended_installed_plugins().len());
    for plugin in manager.extended_installed_plugins() {
        run_data.insert(plugin.entity.dir_path.clone(), plugin.run_data.clone());
        installed.push(plugin.entity.clone());
    }

    let mut invalid = Vec::with_capacity(manager.extended_invalid_plugins().len());
    for plugin in manager.extended_invalid_plugins() {
        run_data.insert(plugin.entity.dir_path.clone(), plugin.run_data.clone());
        invalid.push(plugin.entity.clone());
    }

    PluginsData {
        installed,
        invalid,
        run_data,
    }
}

fn manager_unavailable() -> PluginsManagerError {
    PluginsManagerError::Other("Plugins manager is not available.".into())
}
