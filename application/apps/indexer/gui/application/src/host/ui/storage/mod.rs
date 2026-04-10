//! Host-side storage coordination.
//!
//! `HostStorage` owns the UI-facing storage domains and coordinates load/save
//! requests, while the host service storage worker remains responsible for disk I/O.

use std::{
    sync::mpsc::{self as std_mpsc, Receiver as StdReceiver},
    time::Duration,
};

use log::{trace, warn};
use tokio::sync::mpsc;

use crate::host::{command::HostCommand, notification::AppNotification, ui::UiActions};

pub use file_explorer::{
    FavoriteFolder, FavoriteFoldersScanRequest, FileExplorerData, FileExplorerStorage, FileUiInfo,
};
pub use recent::MAX_RECENT_SESSIONS;
pub use recent::{
    RecentSessionReopenMode, RecentSessionSnapshot, RecentSessionSource, RecentSessionsData,
    RecentSessionsStorage,
};
pub use types::{LoadState, StorageError, StorageErrorKind, StorageEvent, StorageSaveData};

mod file_explorer;
mod recent;
mod types;

type SaveConfirmationRx = StdReceiver<Result<(), StorageError>>;

const WAIT_PENDING_SAVE_TIMEOUT: Duration = Duration::from_millis(1000);

#[derive(Debug)]
pub struct HostStorage {
    cmd_tx: mpsc::Sender<HostCommand>,
    pub file_explorer: FileExplorerStorage,
    pub recent_sessions: RecentSessionsStorage,
    /// Save completion for the aggregate storage snapshot currently in flight.
    pending_save: Option<SaveConfirmationRx>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum SaveOutcome {
    Succeeded,
    Failed,
}

impl HostStorage {
    /// Creates the host-side storage coordinator.
    pub fn new(cmd_tx: mpsc::Sender<HostCommand>, recent_sessions: RecentSessionsData) -> Self {
        Self {
            cmd_tx,
            file_explorer: FileExplorerStorage::new(),
            recent_sessions: RecentSessionsStorage::new(recent_sessions),
            pending_save: None,
        }
    }

    /// Queues a non-blocking save when any storage domain has dirty data.
    pub fn schedule_save(&mut self, ui_actions: &mut UiActions) {
        if self.pending_save.is_some() {
            trace!("Skipping storage save while another save is in progress");
            return;
        }

        let Some(data) = self.collect_save_data() else {
            return;
        };

        self.send_save_cmd(data, ui_actions);
    }

    /// Applies any completed save result without blocking the UI thread.
    pub fn poll_pending_save(&mut self, ui_actions: &mut UiActions) {
        let Some(result) = self.take_pending_save_result() else {
            return;
        };

        self.handle_save_result(result, ui_actions);
    }

    /// Waits for the current save, or starts one first if data is still dirty.
    pub fn wait_until_save(&mut self, ui_actions: &mut UiActions) {
        if self.pending_save.is_none() {
            let Some(data) = self.collect_save_data() else {
                return;
            };

            if !self.send_save_cmd(data, ui_actions) {
                return;
            }
        }

        let Some(result) = self.wait_for_pending_save() else {
            return;
        };

        self.handle_save_result(result, ui_actions);
    }

    /// Collects one aggregate save payload from all dirty storage domains.
    fn collect_save_data(&self) -> Option<Box<StorageSaveData>> {
        let data = StorageSaveData {
            file_explorer: self.file_explorer.get_save_data(),
            recent_sessions: self.recent_sessions.get_save_data(),
        };

        (data.recent_sessions.is_some() || data.file_explorer.is_some()).then_some(Box::new(data))
    }

    /// Applies the aggregate save result back to child storage domains.
    fn finish_save(&mut self, outcome: SaveOutcome) {
        match outcome {
            SaveOutcome::Succeeded => {
                self.file_explorer.apply_save_success();
                self.recent_sessions.apply_save_success();
            }
            SaveOutcome::Failed => {
                self.file_explorer.apply_save_error();
                self.recent_sessions.apply_save_error();
            }
        }
    }

    fn send_save_cmd(&mut self, data: Box<StorageSaveData>, ui_actions: &mut UiActions) -> bool {
        let (confirm_tx, confirm_rx) = std_mpsc::channel();
        let cmd = HostCommand::SaveStorage { data, confirm_tx };

        if !ui_actions.try_send_command(&self.cmd_tx, cmd) {
            self.finish_save(SaveOutcome::Failed);
            ui_actions.add_notification(AppNotification::Error(
                "Failed to queue storage save.".into(),
            ));
            warn!("Failed to queue storage save command");
            return false;
        }

        self.pending_save = Some(confirm_rx);
        true
    }

    fn take_pending_save_result(&mut self) -> Option<Result<(), StorageError>> {
        let result = match self.pending_save.as_ref()?.try_recv() {
            Ok(result) => result,
            Err(std_mpsc::TryRecvError::Empty) => return None,
            Err(std_mpsc::TryRecvError::Disconnected) => Err(StorageError {
                kind: StorageErrorKind::Write,
                message: "Storage save confirmation channel closed.".into(),
            }),
        };

        self.pending_save = None;
        Some(result)
    }

    fn wait_for_pending_save(&mut self) -> Option<Result<(), StorageError>> {
        let confirm_rx = self.pending_save.take()?;

        Some(match confirm_rx.recv_timeout(WAIT_PENDING_SAVE_TIMEOUT) {
            Ok(result) => result,
            Err(std_mpsc::RecvTimeoutError::Timeout) => {
                warn!("Timed out waiting for storage save during shutdown");
                Err(StorageError {
                    kind: StorageErrorKind::Write,
                    message: "Timed out waiting for storage save.".into(),
                })
            }
            Err(std_mpsc::RecvTimeoutError::Disconnected) => {
                warn!("Storage save confirmation channel closed during shutdown");
                Err(StorageError {
                    kind: StorageErrorKind::Write,
                    message: "Storage save confirmation channel closed.".into(),
                })
            }
        })
    }

    fn handle_save_result(&mut self, result: Result<(), StorageError>, ui_actions: &mut UiActions) {
        let outcome = if result.is_ok() {
            SaveOutcome::Succeeded
        } else {
            SaveOutcome::Failed
        };

        self.finish_save(outcome);

        if let Err(err) = result {
            ui_actions.add_notification(AppNotification::Error(err.to_string()));
        }
    }

    /// Routes storage worker events back into the relevant UI-side domains.
    pub fn handle_event(&mut self, event: StorageEvent, ui_actions: &mut UiActions) {
        match event {
            StorageEvent::FileExplorerLoaded(result) => {
                let err = self.file_explorer.finish_load(result);
                self.notify_storage_error(err, ui_actions);
            }
            StorageEvent::FavoriteFoldersScanned { request_id, result } => {
                let err = self.file_explorer.finish_scan(request_id, result);
                self.notify_storage_error(err, ui_actions);
            }
        }
    }

    fn notify_storage_error(&self, err: Option<StorageError>, ui_actions: &mut UiActions) {
        if let Some(err) = err {
            ui_actions.add_notification(AppNotification::Error(err.to_string()));
        }
    }
}

#[cfg(test)]
mod tests {
    use std::{thread, time::Duration};

    use super::{
        FavoriteFolder, FileExplorerData, HostStorage, LoadState, RecentSessionSnapshot,
        RecentSessionsData, StorageError, StorageErrorKind, StorageEvent,
    };
    use crate::host::{command::HostCommand, notification::AppNotification, ui::UiActions};

    fn test_storage() -> (HostStorage, tokio::sync::mpsc::Receiver<HostCommand>) {
        let (cmd_tx, cmd_rx) = tokio::sync::mpsc::channel(1);
        (
            HostStorage::new(cmd_tx, RecentSessionsData::default()),
            cmd_rx,
        )
    }

    fn test_ui_actions() -> (tokio::runtime::Runtime, UiActions) {
        let runtime = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .expect("test runtime should be created");
        let ui_actions = UiActions::new(runtime.handle().clone());

        (runtime, ui_actions)
    }

    fn make_dirty(storage: &mut HostStorage) {
        let snapshot = RecentSessionSnapshot::from_observe_options(
            String::from("test"),
            stypes::ObserveOptions::file(
                std::env::temp_dir().join("chipmunk-storage-mod-test.log"),
                stypes::FileFormat::Text,
                stypes::ParserType::Text(()),
            ),
        );
        storage.recent_sessions.register_session(snapshot);
    }

    fn make_file_explorer_dirty(storage: &mut HostStorage) {
        storage
            .file_explorer
            .finish_load(Ok(Box::new(FileExplorerData {
                favorite_folders: vec![FavoriteFolder::new(std::env::temp_dir())],
            })));
        storage.file_explorer.dirty = true;
    }

    #[test]
    fn save_data_requires_dirty_storage() {
        let (mut storage, _) = test_storage();

        assert!(storage.collect_save_data().is_none());

        make_dirty(&mut storage);

        let data = storage.collect_save_data();

        assert!(matches!(
            data,
            Some(data) if data.recent_sessions.is_some()
        ));
    }

    #[test]
    fn save_data_includes_file_explorer() {
        let (mut storage, _) = test_storage();

        make_file_explorer_dirty(&mut storage);

        let data = storage.collect_save_data();

        assert!(matches!(
            data,
            Some(data) if data.file_explorer.is_some()
        ));
    }

    #[test]
    fn schedule_save_tracks_pending_request() {
        let (mut storage, mut cmd_rx) = test_storage();
        let (_runtime, mut ui_actions) = test_ui_actions();

        make_dirty(&mut storage);
        make_file_explorer_dirty(&mut storage);
        storage.schedule_save(&mut ui_actions);

        assert!(storage.pending_save.is_some());
        assert!(matches!(
            cmd_rx.try_recv(),
            Ok(HostCommand::SaveStorage { data, .. })
                if data.recent_sessions.is_some() && data.file_explorer.is_some()
        ));
    }

    #[test]
    fn poll_save_success_clears_dirty() {
        let (mut storage, mut cmd_rx) = test_storage();
        let (_runtime, mut ui_actions) = test_ui_actions();

        make_dirty(&mut storage);
        make_file_explorer_dirty(&mut storage);
        storage.schedule_save(&mut ui_actions);

        let HostCommand::SaveStorage { confirm_tx, .. } =
            cmd_rx.try_recv().expect("save command should be queued")
        else {
            panic!("save command should be queued");
        };
        confirm_tx
            .send(Ok(()))
            .expect("save confirmation should be sent");

        storage.poll_pending_save(&mut ui_actions);

        assert!(storage.pending_save.is_none());
        assert!(!storage.file_explorer.dirty);
        assert!(!storage.recent_sessions.dirty);
    }

    #[test]
    fn poll_save_error_notifies() {
        let (mut storage, mut cmd_rx) = test_storage();
        let (_runtime, mut ui_actions) = test_ui_actions();

        make_dirty(&mut storage);
        make_file_explorer_dirty(&mut storage);
        storage.schedule_save(&mut ui_actions);

        let HostCommand::SaveStorage { confirm_tx, .. } =
            cmd_rx.try_recv().expect("save command should be queued")
        else {
            panic!("save command should be queued");
        };
        confirm_tx
            .send(Err(StorageError {
                kind: StorageErrorKind::Write,
                message: "disk full".into(),
            }))
            .expect("save confirmation should be sent");

        storage.poll_pending_save(&mut ui_actions);

        assert!(storage.pending_save.is_none());
        assert!(storage.file_explorer.dirty);
        assert!(storage.recent_sessions.dirty);
        assert!(matches!(
            ui_actions.drain_notifications().next(),
            Some(AppNotification::Error(message)) if message.contains("disk full")
        ));
    }

    #[test]
    fn flush_waits_for_pending_save() {
        let (mut storage, mut cmd_rx) = test_storage();
        let (_runtime, mut ui_actions) = test_ui_actions();

        make_dirty(&mut storage);
        make_file_explorer_dirty(&mut storage);
        storage.schedule_save(&mut ui_actions);

        let HostCommand::SaveStorage { confirm_tx, .. } =
            cmd_rx.try_recv().expect("save command should be queued")
        else {
            panic!("save command should be queued");
        };

        let sender = thread::spawn(move || {
            thread::sleep(Duration::from_millis(10));
            confirm_tx
                .send(Ok(()))
                .expect("save confirmation should be sent");
        });

        storage.wait_until_save(&mut ui_actions);
        sender.join().expect("save sender should finish");

        assert!(storage.pending_save.is_none());
        assert!(!storage.file_explorer.dirty);
        assert!(!storage.recent_sessions.dirty);
    }

    #[test]
    fn flush_starts_save_when_dirty() {
        let (mut storage, mut cmd_rx) = test_storage();
        let (_runtime, mut ui_actions) = test_ui_actions();

        make_dirty(&mut storage);
        make_file_explorer_dirty(&mut storage);

        let sender = thread::spawn(move || {
            for _ in 0..20 {
                match cmd_rx.try_recv() {
                    Ok(HostCommand::SaveStorage { confirm_tx, data }) => {
                        assert!(data.file_explorer.is_some());
                        assert!(data.recent_sessions.is_some());
                        confirm_tx
                            .send(Ok(()))
                            .expect("save confirmation should be sent");
                        return;
                    }
                    Err(tokio::sync::mpsc::error::TryRecvError::Empty) => {
                        thread::sleep(Duration::from_millis(5));
                    }
                    Err(err) => panic!("unexpected save command state: {err:?}"),
                    Ok(other) => panic!("unexpected command: {other:?}"),
                }
            }

            panic!("save command should be queued during shutdown");
        });

        storage.wait_until_save(&mut ui_actions);
        sender.join().expect("save sender should finish");

        assert!(storage.pending_save.is_none());
        assert!(!storage.file_explorer.dirty);
        assert!(!storage.recent_sessions.dirty);
    }

    #[test]
    fn file_explorer_load_events_route_to_domain() {
        let (mut storage, _) = test_storage();
        let (_runtime, mut ui_actions) = test_ui_actions();

        storage.handle_event(
            StorageEvent::FileExplorerLoaded(Ok(Box::new(FileExplorerData {
                favorite_folders: vec![FavoriteFolder::new(std::env::temp_dir())],
            }))),
            &mut ui_actions,
        );

        assert!(matches!(
            storage.file_explorer.state,
            LoadState::Ready(FileExplorerData { favorite_folders }) if favorite_folders.len() == 1
        ));
    }
}
