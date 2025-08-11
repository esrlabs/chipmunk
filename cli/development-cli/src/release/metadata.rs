//! The module handles serializing and writing release metadata such as custom prefix for
//! archive name ...etc.

use std::fs::{self, File};

use anyhow::Context;
use serde::Serialize;

use crate::release::paths::release_bin_path;

const METADATA_FILENAME: &str = ".metadata";

/// Includes metadata related to the app and the release such as custom platform for
/// archive name...
#[derive(Debug, Clone, Serialize)]
pub struct ReleaseMetadata<'a> {
    pub custom_platform: Option<&'a str>,
}

impl ReleaseMetadata<'_> {
    /// Checks if metadata struct actually contains metadata within.
    pub fn is_empty(&self) -> bool {
        let Self { custom_platform } = self;

        !custom_platform.is_some()
    }
}

/// Write metadata file into the release path.
/// Metadata includes data related to Chipmunk app and release such as `custom_platform`
pub fn write_metadata(custom_platform: &str) -> anyhow::Result<()> {
    let metadata = ReleaseMetadata {
        custom_platform: Some(custom_platform),
    };

    assert!(
        !metadata.is_empty(),
        "We shouldn't write an empty metadata file."
    );

    let release_bin = release_bin_path();

    let metadata_file = release_bin.join(METADATA_FILENAME);
    if metadata_file.exists() {
        println!(
            "Removing already existing metadata file to be rewritten. File: {}",
            metadata_file.display()
        );
        fs::remove_file(&metadata_file).context("Error while removing snapshot file")?;
    }

    let mut file = File::create(metadata_file).context("Error while creating metadata file")?;

    serde_json::to_writer_pretty(&mut file, &metadata).context("Error while writing metadata file")
}
