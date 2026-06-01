//! Download helpers for built-in app updates.

use std::{
    path::{Component, Path, PathBuf},
    result::Result,
};
use thiserror::Error;
use tokio::{fs, io::AsyncWriteExt};
use uuid::Uuid;

use crate::host::ui::update::{DownloadUpdateParam, DownloadedUpdate};

const USER_AGENT: &str = "chipmunk";

/// Failure while downloading a built-in app update artifact.
#[derive(Debug, Error)]
pub enum DownloadUpdateError {
    /// The update staging directory could not be prepared.
    #[error("failed to prepare update staging directory: {0}")]
    PrepareDirectory(#[source] std::io::Error),
    /// The release artifact name cannot be used as a local file name.
    #[error("invalid update artifact name")]
    InvalidArtifactName,
    /// The artifact download request failed.
    #[error("failed to download update artifact: {0}")]
    Download(#[from] reqwest::Error),
    /// The downloaded artifact could not be written to disk.
    #[error("failed to write update artifact: {0}")]
    WriteArtifact(#[source] std::io::Error),
}

/// Downloads the selected update artifact and returns its local path.
pub async fn download_update(
    request: DownloadUpdateParam,
) -> Result<DownloadedUpdate, DownloadUpdateError> {
    let download_dir = unique_download_dir(&request)?;
    let artifact_dir = download_dir.join("artifact");
    fs::create_dir_all(&artifact_dir)
        .await
        .map_err(DownloadUpdateError::PrepareDirectory)?;

    let artifact_name = artifact_file_name(&request.plan.artifact.name)?;
    let artifact_path = artifact_dir.join(artifact_name);
    download_artifact(&request.plan.artifact.download_url, &artifact_path).await?;

    let downloaded_update = DownloadedUpdate {
        latest_version: request.latest_version,
        release_url: request.release_url,
        plan: request.plan,
        artifact_path,
    };

    Ok(downloaded_update)
}

/// Builds an isolated download directory so repeated requests never share partial files.
fn unique_download_dir(request: &DownloadUpdateParam) -> Result<PathBuf, DownloadUpdateError> {
    let downloads_dir = session_core::paths::get_chipmunk_downloads_dir().map_err(|err| {
        let message = err.to_string();
        DownloadUpdateError::PrepareDirectory(std::io::Error::other(message))
    })?;

    let download_dir = downloads_dir.join("app-update").join(format!(
        "{}-{}",
        request.latest_version,
        Uuid::new_v4()
    ));

    Ok(download_dir)
}

/// Accepts only plain artifact file names, not paths supplied by release metadata.
fn artifact_file_name(name: &str) -> Result<&str, DownloadUpdateError> {
    let path = Path::new(name);
    let mut components = path.components();
    let Some(Component::Normal(file_name)) = components.next() else {
        return Err(DownloadUpdateError::InvalidArtifactName);
    };
    if components.next().is_some() {
        return Err(DownloadUpdateError::InvalidArtifactName);
    }

    file_name
        .to_str()
        .ok_or(DownloadUpdateError::InvalidArtifactName)
}

/// Streams the artifact to a partial file and renames it after a complete write.
async fn download_artifact(url: &str, artifact_path: &Path) -> Result<(), DownloadUpdateError> {
    let file_name = artifact_path
        .file_name()
        .and_then(|file_name| file_name.to_str())
        .ok_or(DownloadUpdateError::InvalidArtifactName)?;
    let part_path = artifact_path.with_file_name(format!("{file_name}.part"));

    let response = reqwest::Client::new()
        .get(url)
        .header(reqwest::header::USER_AGENT, USER_AGENT)
        .send()
        .await?
        .error_for_status()?;

    let mut file = fs::File::create(&part_path)
        .await
        .map_err(DownloadUpdateError::WriteArtifact)?;
    let mut response = response;
    while let Some(chunk) = response.chunk().await? {
        file.write_all(&chunk)
            .await
            .map_err(DownloadUpdateError::WriteArtifact)?;
    }
    file.flush()
        .await
        .map_err(DownloadUpdateError::WriteArtifact)?;
    drop(file);

    fs::rename(&part_path, artifact_path)
        .await
        .map_err(DownloadUpdateError::WriteArtifact)?;

    Ok(())
}
