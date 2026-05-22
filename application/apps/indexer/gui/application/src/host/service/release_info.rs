use anyhow::Result;
use log::{trace, warn};
use semver::Version;
use serde::Deserialize;

use crate::{
    common::app_info,
    host::{
        communication::ServiceSenders,
        message::{AppChangelog, AppVersionUpdate, HostMessage},
        ui::storage::settings::UpdateSettings,
    },
};

const OWNER: &str = "esrlabs";
const REPO: &str = "chipmunk";
const RELEASES_LIMIT: usize = 10;
const USER_AGENT: &str = "chipmunk";

#[derive(Debug, Deserialize)]
struct ReleaseInfo {
    tag_name: String,
    body: Option<String>,
    html_url: String,
    draft: bool,
}

/// Spawns a background check for release metadata in the current major series.
pub fn spawn_update_check(
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
    let should_show_changelog = previous_version
        .as_ref()
        .is_some_and(|previous_version| previous_version < current_version);

    if !settings.check_for_updates && !should_show_changelog {
        trace!("Skipping release check because it is disabled in application settings.");
        return;
    }

    let releases = match fetch_release_info().await {
        Ok(releases) => releases,
        Err(err) => {
            warn!("Failed to fetch GitHub releases: {err:#}");
            return;
        }
    };

    if should_show_changelog {
        send_current_changelog(&senders, &releases, current_version).await;
    }

    if !settings.check_for_updates {
        return;
    }

    //TODO: Honor check_pre_releases when pre-release filtering is added.
    let Some((latest_version, release)) =
        latest_current_major_release(&releases, current_version.major)
    else {
        trace!(
            "No release found for the current major version in the latest \
            {RELEASES_LIMIT} GitHub releases."
        );
        return;
    };

    if latest_version <= *current_version {
        trace!(
            "Application is up to date for the current major version. \
            current_version={current_version}, latest_version={latest_version}"
        );
        return;
    }

    let update = AppVersionUpdate {
        latest_version,
        release_url: release.html_url.clone(),
    };

    senders
        .send_message(HostMessage::AppVersionUpdate(Box::new(update)))
        .await;
}

fn parse_version(version: &str) -> Result<Version, semver::Error> {
    Version::parse(version.trim_start_matches('v'))
}

/// Sends release notes for the currently running version after an app update.
async fn send_current_changelog(
    senders: &ServiceSenders,
    releases: &[ReleaseInfo],
    current_version: &Version,
) {
    let Some(release) = current_release(releases, current_version) else {
        return;
    };

    let Some(release_notes) = release.body.as_ref().filter(|body| !body.trim().is_empty()) else {
        return;
    };

    let changelog = AppChangelog {
        version: current_version.clone(),
        release_notes: release_notes.clone(),
        release_url: release.html_url.clone(),
    };

    senders
        .send_message(HostMessage::AppChangelog(Box::new(changelog)))
        .await;
}

fn current_release<'a>(
    releases: &'a [ReleaseInfo],
    current_version: &Version,
) -> Option<&'a ReleaseInfo> {
    releases.iter().find(|release| {
        !release.draft
            && parse_version(&release.tag_name)
                .ok()
                .is_some_and(|version| version == *current_version)
    })
}

/// Returns the newest non-draft release that parses as the current major version.
fn latest_current_major_release(
    releases: &[ReleaseInfo],
    current_major: u64,
) -> Option<(Version, &ReleaseInfo)> {
    let mut matching_releases = releases
        .iter()
        .filter_map(|release| {
            if release.draft {
                return None;
            }

            let version = parse_version(&release.tag_name)
                .inspect_err(|err| {
                    warn!(
                        "Failed to parse GitHub release version '{}': {err}",
                        release.tag_name
                    );
                })
                .ok()?;

            (version.major == current_major).then_some((version, release))
        })
        .collect::<Vec<_>>();

    matching_releases.sort_unstable_by(|(left, _), (right, _)| left.cmp(right));
    matching_releases.pop()
}

/// Fetches the latest published releases from GitHub.
async fn fetch_release_info() -> Result<Vec<ReleaseInfo>> {
    let client = reqwest::Client::new();
    let url = format!(
        "https://api.github.com/repos/{OWNER}/{REPO}/releases?per_page={RELEASES_LIMIT}&page=1"
    );

    let response = client
        .get(url)
        .header(reqwest::header::USER_AGENT, USER_AGENT)
        .send()
        .await?
        .error_for_status()?;

    Ok(response.json().await?)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn release(tag_name: &str) -> ReleaseInfo {
        ReleaseInfo {
            tag_name: tag_name.into(),
            body: None,
            html_url: String::from("https://example.com/release"),
            draft: false,
        }
    }

    #[test]
    fn prerelease_versions_follow_semver_order() {
        let alpha_1 = parse_version("4.0.0-alpha.1").expect("alpha.1 should parse");
        let alpha_2 = parse_version("4.0.0-alpha.2").expect("alpha.2 should parse");
        let beta_1 = parse_version("4.0.0-beta.1").expect("beta.1 should parse");
        let beta_2 = parse_version("4.0.0-beta.2").expect("beta.2 should parse");
        let stable = parse_version("4.0.0").expect("stable should parse");

        assert!(alpha_1 < alpha_2);
        assert!(alpha_2 < beta_1);
        assert!(beta_1 < beta_2);
        assert!(beta_2 < stable);
    }

    #[test]
    fn dotted_prerelease_format_is_rejected() {
        assert!(parse_version("4.0.0.alpha-1").is_err());
        assert!(parse_version("4.0.0.alpha-2").is_err());
        assert!(parse_version("4.0.0.beta-1").is_err());
        assert!(parse_version("4.0.0.beta-2").is_err());
    }

    #[test]
    fn latest_current_major_release_sorts_versions() {
        let releases = vec![
            release("4.0.0-alpha.1"),
            release("5.0.0-alpha.1"),
            release("4.0.0-beta.1"),
            release("4.0.0-beta.2"),
        ];
        let latest = latest_current_major_release(&releases, 4)
            .expect("current major release should be found");

        assert_eq!(latest.0, parse_version("4.0.0-beta.2").unwrap());
        assert_eq!(latest.1.tag_name, "4.0.0-beta.2");
    }

    #[test]
    fn current_release_matches_exact_version() {
        let releases = vec![release("4.0.0-alpha.1"), release("4.0.0-beta.1")];
        let current_version = parse_version("4.0.0-beta.1").unwrap();

        let current = current_release(&releases, &current_version)
            .expect("exact current version release should be found");

        assert_eq!(current.tag_name, "4.0.0-beta.1");
    }
}
