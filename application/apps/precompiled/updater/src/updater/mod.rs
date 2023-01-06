use crate::env::{
    args::Arguments,
    compressed::{Compressed, CompressedError},
    release_files::ReleaseFilesError,
};
use thiserror::Error;

mod linux;
mod macos;
mod win;

#[derive(Error, Debug)]
pub enum UpdateError {
    #[error("InvalidPlatform error ({0})")]
    InvalidPlatform(String),
    #[error("UnsupportedPlatform error")]
    UnsupportedPlatform,
    #[error("CompressedError error ({0})")]
    CompressedError(CompressedError),
    #[error("ReleaseFilesError error ({0})")]
    ReleaseFilesError(ReleaseFilesError),
    #[error("IO error ({0})")]
    IO(String),
}

pub trait Updater {
    fn new(args: Arguments, compressed: Compressed) -> Result<Box<Self>, UpdateError>;
    fn update(&self) -> Result<(), UpdateError>;
}

pub fn update(args: Arguments) -> Result<(), UpdateError> {
    let compressed = Compressed::new(&args.compressed).map_err(UpdateError::CompressedError)?;
    if cfg!(target_os = "windows") {
        win::PlatformUpdater::new(args, compressed)?.update()
    } else if cfg!(target_os = "linux") {
        linux::PlatformUpdater::new(args, compressed)?.update()
    } else if cfg!(target_os = "macos") {
        macos::PlatformUpdater::new(args, compressed)?.update()
    } else {
        Err(UpdateError::UnsupportedPlatform)
    }
}
