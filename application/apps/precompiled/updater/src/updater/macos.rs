use crate::{
    env::{args::Arguments, compressed::Compressed},
    updater::{UpdateError, Updater},
};
use fs_extra::dir;
use std::fs;

const DEFAULT_MAC_APP_FOLDER: &str = "chipmunk.app";

pub struct PlatformUpdater {
    args: Arguments,
    compressed: Compressed,
}

impl Updater for PlatformUpdater {
    fn new(args: Arguments, compressed: Compressed) -> Result<Box<Self>, UpdateError> {
        if cfg!(target_os = "macos") {
            Ok(Box::new(PlatformUpdater { args, compressed }))
        } else {
            Err(UpdateError::InvalidPlatform(String::from(
                "Expecting macos platform",
            )))
        }
    }

    fn update(&self) -> Result<(), UpdateError> {
        // Extract new release into temp location
        self.compressed
            .unpack(&self.compressed.location)
            .map_err(UpdateError::CompressedError)?;
        // Rename application if it was renamed by user
        if self.args.app_name != *DEFAULT_MAC_APP_FOLDER {
            log::debug!("Chipmunk application folder had been renamed by user to {:?}; downloaded version of application should be renamed too.", self.args.app_name);
            let renamed_app_name = self.compressed.location.join(&self.args.app_name);
            if renamed_app_name.exists() {
                log::debug!("Detected {renamed_app_name:?}. This app-bundle will be removed",);
                if let Err(err) = fs::remove_dir_all(&renamed_app_name) {
                    log::warn!("Fail to remove app-bundle {renamed_app_name:?} due error {err}",);
                } else {
                    log::debug!("file {renamed_app_name:?} removed");
                }
            }
            fs::rename(
                self.compressed.location.join(DEFAULT_MAC_APP_FOLDER),
                &renamed_app_name,
            )
            .map_err(|e| UpdateError::IO(format!("Fail to do renaming: {e}")))?;
            log::debug!(
                "Chipmunk application has been renamed to {:?}",
                renamed_app_name
            );
        }
        // Copy files
        let mut options = dir::CopyOptions::new();
        options.overwrite = true;
        let src = self.compressed.location.join(&self.args.app_name);
        let dest = &self.args.location;
        log::debug!("Will copy {src:?} to {dest:?}");
        dir::copy(&src, dest, &options)
            .map_err(|e| UpdateError::IO(format!("Fail to copy folder: {e:?}")))?;
        debug!("All copied from {src:?} to {dest:?}");
        // Clean up
        if let Err(err) = fs::remove_dir_all(&src) {
            log::warn!("Fail to remove app-bundle {src:?} due error {err}",);
        } else {
            log::debug!("file {src:?} removed");
        }
        Ok(())
    }
}
