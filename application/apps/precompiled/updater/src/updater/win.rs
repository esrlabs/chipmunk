use crate::{
    env::{args::Arguments, compressed::Compressed, release_files::ReleaseFiles},
    updater::{UpdateError, Updater},
};
pub struct PlatformUpdater {
    args: Arguments,
    compressed: Compressed,
}

impl Updater for PlatformUpdater {
    fn new(args: Arguments, compressed: Compressed) -> Result<Box<Self>, UpdateError> {
        if cfg!(target_os = "windows") {
            Ok(Box::new(PlatformUpdater { args, compressed }))
        } else {
            Err(UpdateError::InvalidPlatform(String::from(
                "Expecting windows platform",
            )))
        }
    }

    fn update(&self) -> Result<(), UpdateError> {
        // Extract previous release files
        let release_files =
            ReleaseFiles::new(&self.args.location).map_err(UpdateError::ReleaseFilesError)?;
        // Remove previous release files
        release_files
            .remove()
            .map_err(UpdateError::ReleaseFilesError)?;
        // Extract new release into location of previous release
        self.compressed
            .unpack(&self.args.location)
            .map_err(UpdateError::CompressedError)
    }
}
