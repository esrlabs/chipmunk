//! Startup state loaded before the host service loop starts running.

use tokio::runtime::Handle;

use crate::host::{
    communication::ServiceSenders,
    notification::AppNotification,
    service::storage,
    ui::storage::{
        presets::PresetsData, recent::storage::RecentSessionsStorage, settings::AppSettings,
        types::StorageError,
    },
};

/// Startup data returned after the host service runtime has initialized.
#[derive(Debug)]
pub struct HostServiceInit {
    /// Tokio runtime handle used by UI actions that spawn async work.
    pub tokio_handle: Handle,
    /// Recent sessions loaded synchronously for initial UI state.
    pub recent_sessions: RecentSessionsStorage,
    /// Application settings loaded synchronously before startup tasks run.
    pub app_settings: AppSettings,
    /// Stored presets loaded synchronously for the initial preset registry.
    pub presets: PresetsData,
}

impl HostServiceInit {
    /// Loads all storage domains needed by the UI before the first frame.
    ///
    /// Domains load independently: a failing domain is reported and replaced by its
    /// defaults so the application can still start.
    pub async fn load(tokio_handle: Handle, senders: &ServiceSenders) -> Self {
        Self {
            tokio_handle,
            recent_sessions: load_or_notify(senders, storage::recent::load_sessions).await,
            app_settings: load_or_notify(senders, storage::settings::load_settings).await,
            presets: load_or_notify(senders, storage::presets::load).await,
        }
    }
}

/// Loads one startup domain, reporting a failure to the UI and falling back to its defaults.
async fn load_or_notify<T: Default>(
    senders: &ServiceSenders,
    load: impl FnOnce() -> Result<T, StorageError>,
) -> T {
    // Startup loads run before any service task is spawned, so blocking reads are done inline.
    match load() {
        Ok(data) => data,
        Err(err) => {
            senders
                .send_notification(AppNotification::Error(err.to_string()))
                .await;
            T::default()
        }
    }
}
