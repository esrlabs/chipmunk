use flate2::read::GzDecoder;
use std::{
    fs::{self, File},
    path::PathBuf,
};
use tar::Archive;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum CompressedError {
    #[error("Location error ({0})")]
    Location(String),
    #[error("Unpack error ({0})")]
    Unpack(String),
    #[error("Removing error ({0})")]
    Removing(String),
}

pub struct Compressed {
    release_file: PathBuf,
    pub location: PathBuf,
}

impl Compressed {
    pub fn new(release_file: &PathBuf) -> Result<Self, CompressedError> {
        Ok(Self {
            release_file: release_file.clone(),
            location: release_file
                .parent()
                .ok_or(CompressedError::Location(format!(
                    "No parent for {release_file:?}"
                )))?
                .to_path_buf(),
        })
    }

    pub fn unpack(&self, dest: &PathBuf) -> Result<(), CompressedError> {
        log::debug!(
            "File {:?} will be unpacked into {:?}",
            self.release_file,
            dest
        );
        let tar_gz = File::open(&self.release_file).map_err(|e| {
            CompressedError::Unpack(format!(
                "Cannot open release file {:?}: {e:?}",
                self.release_file
            ))
        })?;
        let tar = GzDecoder::new(tar_gz);
        let mut archive = Archive::new(tar);
        archive.unpack(dest).map_err(|e| {
            CompressedError::Unpack(format!(
                "Cannot unpack release file {:?}: {e:?}",
                self.release_file
            ))
        })?;
        log::debug!(
            "File {:?} has been unpacked into {:?}",
            self.release_file,
            dest
        );
        if let Err(err) = self.clean() {
            log::warn!(
                "File {:?} has not been removed; error: {err}",
                self.release_file,
            );
        } else {
            log::debug!("File {:?} has been removed", self.release_file,);
        }
        Ok(())
    }

    fn clean(&self) -> Result<(), CompressedError> {
        fs::remove_file(&self.release_file).map_err(|e| CompressedError::Removing(e.to_string()))
    }
}
