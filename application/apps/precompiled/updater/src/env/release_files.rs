use crate::env;
use std::{fs, path::PathBuf, thread, time};
use thiserror::Error;

const RELEASE_FILE_NAME: &str = ".release";
const PEDNING_CLOSING_APP_TIME_MS: u64 = 3000;
const ATTEMPTS_TO_REMOVE: u8 = 5;

#[derive(Error, Debug)]
pub enum ReleaseFilesError {
    #[error("NoReleaseFile error ({0})")]
    NoReleaseFile(String),
    #[error("Reading error ({0})")]
    Reading(String),
    #[error("Removing error ({0})")]
    Removing(String),
}
pub struct ReleaseFiles {
    app_folder: PathBuf,
    entries: Vec<String>,
}

impl ReleaseFiles {
    pub fn new(app_folder: &PathBuf) -> Result<Self, ReleaseFilesError> {
        log::debug!("Looking for release file {RELEASE_FILE_NAME} in {app_folder:?}");
        let release_file: PathBuf = app_folder.to_path_buf().join(RELEASE_FILE_NAME);
        if !release_file.exists() {
            log::error!("Release file {release_file:?} doesn't exist");
            return Err(ReleaseFilesError::NoReleaseFile(format!(
                "{RELEASE_FILE_NAME} doesn't exist in {app_folder:?}"
            )));
        }
        log::debug!("Reading release file {release_file:?}");
        match fs::read_to_string(&release_file) {
            Err(e) => Err(ReleaseFilesError::Reading(format!(
                "Fail to read {RELEASE_FILE_NAME}: {e:?}"
            ))),
            Ok(content) => Ok(ReleaseFiles {
                app_folder: app_folder.clone(),
                entries: content.lines().map(|s| s.to_string()).collect(),
            }),
        }
    }

    pub fn remove(&self) -> Result<(), ReleaseFilesError> {
        let mut attempts: u8 = 0;
        loop {
            log::info!(
                "Will sleep {PEDNING_CLOSING_APP_TIME_MS}ms to let parent app to be closed."
            );
            let waiting = time::Duration::from_millis(PEDNING_CLOSING_APP_TIME_MS);
            thread::sleep(waiting);
            log::debug!(
                "Removing previous release files from {:?}; attempt #{}",
                self.app_folder,
                attempts + 1
            );
            match self.try_to_remove() {
                Ok(_) => {
                    log::debug!(
                        "Previous release files has been removed from {:?} with attempt #{}",
                        self.app_folder,
                        attempts + 1
                    );
                    return Ok(());
                }
                Err(e) => {
                    attempts += 1;
                    log::warn!("Attempt #{attempts} of removing application failed: {e}");
                    if attempts > ATTEMPTS_TO_REMOVE {
                        log::error!("No more attempts to remove application will be done");
                        return Err(ReleaseFilesError::Removing(format!(
                            "Fail to remove files with {attempts} attempts"
                        )));
                    }
                }
            };
        }
    }

    fn try_to_remove(&self) -> Result<(), ReleaseFilesError> {
        for entity in self.entries.iter() {
            let path = self.app_folder.join(entity);
            if path.exists() {
                env::fs::remove_entity(&path).map_err(|e| {
                    ReleaseFilesError::Removing(format!("Fail to remove {path:?}: {e:?}"))
                })?;
                log::info!("- [removed]: {path:?}");
            } else {
                log::warn!("- [not found]: {:?}", path);
            }
        }
        Ok(())
    }
}
