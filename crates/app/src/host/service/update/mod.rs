//! Host service workflow for app release checks and update metadata.

use log::{info, trace, warn};
use semver::Version;

use crate::{
    common::app_info,
    host::{
        communication::ServiceSenders,
        message::HostMessage,
        ui::{
            storage::settings::UpdateSettings,
            update::{
                AppChangelog, AppVersionUpdate, DownloadUpdateParam, DownloadedUpdate, UpdatePlan,
                UpdateWorkflow,
            },
        },
    },
};

mod archive;
mod download;
mod github;
mod install;
mod platform;
mod release;

use self::{github::GithubRelease, platform::UpdateWorkflowErr};

/// Spawns a selected app update download request.
pub fn spawn_download_update(senders: ServiceSenders, request: DownloadUpdateParam) {
    tokio::spawn(async move {
        let result = download::download_update(request).await.map_err(|err| {
            warn!("Failed to download and stage app update: {err:#}");
            err.to_string()
        });

        senders
            .send_message(HostMessage::AppUpdateDownload(Box::new(result)))
            .await;
    });
}

/// Spawns a downloaded app update install-on-exit request.
pub fn spawn_install_update(senders: ServiceSenders, downloaded_update: DownloadedUpdate) {
    tokio::task::spawn_blocking(move || {
        let result = install::launch(&downloaded_update).map_err(|err| {
            warn!("Failed to install downloaded app update: {err:#}");
            err.to_string()
        });

        senders.send_message_blocking(HostMessage::AppUpdateInstall(result));
    });
}

/// Spawns a background check for release metadata in the current major series.
pub fn spawn_check(
    senders: ServiceSenders,
    previous_version: Option<Version>,
    settings: UpdateSettings,
) {
    tokio::spawn(check_for_updates(senders, previous_version, settings));
}

async fn check_for_updates(
    senders: ServiceSenders,
    previous_version: Option<Version>,
    settings: UpdateSettings,
) {
    let current_version = app_info::current_version();
    let show_changelog = previous_version
        .as_ref()
        .is_none_or(|previous_version| previous_version < current_version);

    if !settings.check_for_updates && !show_changelog {
        trace!("Skipping release check because it is disabled in application settings.");
        return;
    }

    let release_metadata =
        match fetch_release_metadata(current_version, &settings, show_changelog).await {
            Ok(metadata) => metadata,
            Err(err) => {
                warn!("Failed to fetch GitHub releases: {err:#}");
                return;
            }
        };

    if let Some(changelog) = release_metadata.changelog {
        senders
            .send_message(HostMessage::AppChangelog(Box::new(changelog)))
            .await;
    }

    if !settings.check_for_updates {
        return;
    }

    let Some((latest_version, release)) = release_metadata.latest_release else {
        trace!("No release found for the current major version in the fetched GitHub releases.");
        return;
    };

    if latest_version <= *current_version {
        trace!(
            "Application is up to date for the current major version. \
            current_version={current_version}, latest_version={latest_version}"
        );
        return;
    }

    let plan = match platform::detect_install_workflow().await {
        Ok(workflow) => resolve_update_plan(&latest_version, workflow, &release.assets),
        Err(err) => {
            log_workflow_error(&err);
            None
        }
    };

    let update = AppVersionUpdate {
        latest_version,
        release_url: release.html_url.clone(),
        plan,
    };

    senders
        .send_message(HostMessage::AppVersionUpdate(Box::new(update)))
        .await;
}

struct ReleaseMetadata {
    changelog: Option<AppChangelog>,
    latest_release: Option<(Version, GithubRelease)>,
}

async fn fetch_release_metadata(
    current_version: &Version,
    settings: &UpdateSettings,
    include_changelog: bool,
) -> anyhow::Result<ReleaseMetadata> {
    let mut changelog = None;
    let mut latest_release = None;
    let mut page = 1;

    loop {
        let page_releases = github::fetch_releases_page(page).await?;

        if page_releases.is_empty() {
            break;
        }

        if include_changelog
            && changelog.is_none()
            && let Some(release) = release::current_release(&page_releases, current_version)
        {
            changelog = Some(AppChangelog {
                version: current_version.clone(),
                release_notes: release.body.clone().unwrap_or_default(),
                release_url: release.html_url.clone(),
            });
        }

        if !settings.check_for_updates {
            break;
        }

        match release::find_update_candidate(
            page_releases,
            current_version.major,
            settings.check_pre_releases,
        ) {
            release::FindCandidateOutcome::Found(version, release) => {
                latest_release = Some((version, release));
                break;
            }
            release::FindCandidateOutcome::ReachedPreviousMajor => {
                let previous_major = current_version.major.saturating_sub(1);
                info!(
                    "Stopping paginated release lookup after reaching major {previous_major} release history."
                );
                break;
            }
            release::FindCandidateOutcome::Continue => {
                page += 1;
            }
        }
    }

    if include_changelog && changelog.is_none() {
        warn!("Release notes for current Chipmunk version {current_version} were not found.");
    }

    Ok(ReleaseMetadata {
        changelog,
        latest_release,
    })
}

fn resolve_update_plan(
    latest_version: &Version,
    workflow: UpdateWorkflow,
    assets: &[github::GithubAsset],
) -> Option<UpdatePlan> {
    match platform::matching_artifact(latest_version, &workflow, assets) {
        Some(artifact) => Some(UpdatePlan { workflow, artifact }),
        None => {
            warn!(
                "No release artifact matches the selected update workflow. \
                latest_version={latest_version}, workflow={workflow:?}"
            );
            None
        }
    }
}

fn log_workflow_error(err: &UpdateWorkflowErr) {
    match err {
        UpdateWorkflowErr::UnsupportedPlatform => {
            trace!("No safe built-in update workflow is available: {err}");
        }
        UpdateWorkflowErr::ArchiveNotWritable(path) => {
            trace!(
                "No safe built-in update workflow is available: {err}. \
                archive_target={}",
                path.display()
            );
        }
        UpdateWorkflowErr::CurrentExeUnavailable
        | UpdateWorkflowErr::InstallPathUnavailable
        | UpdateWorkflowErr::DetectionCommandFailed => {
            warn!("Failed to select built-in update workflow: {err}");
        }
    }
}
