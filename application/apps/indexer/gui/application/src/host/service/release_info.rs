use anyhow::Result;
use log::{info, warn};
use semver::Version;
use serde::Deserialize;

use crate::{
    common::app_version,
    host::{
        communication::ServiceSenders,
        message::{AppVersionUpdate, HostMessage},
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

/// Spawns a background check for a newer GitHub release in the current major series.
pub fn spawn_update_check(senders: ServiceSenders) {
    tokio::spawn(check_for_updates(senders));
}

async fn check_for_updates(senders: ServiceSenders) {
    let releases = match fetch_release_info().await {
        Ok(releases) => releases,
        Err(err) => {
            warn!("Failed to fetch GitHub releases: {err:#}");
            return;
        }
    };

    let current_version = app_version::current_version().clone();

    let Some((latest_version, release)) =
        latest_current_major_release(releases, current_version.major)
    else {
        info!(
            "No release found for the current major version in the latest \
            {RELEASES_LIMIT} GitHub releases."
        );
        return;
    };

    if latest_version <= current_version {
        info!(
            "Application is up to date for the current major version. \
            current_version={current_version}, latest_version={latest_version}"
        );
        return;
    }

    let update = AppVersionUpdate {
        latest_version,
        release_notes: release.body,
        release_url: release.html_url,
    };

    senders
        .send_message(HostMessage::AppVersionUpdate(Box::new(update)))
        .await;
}

fn parse_version(version: &str) -> Result<Version, semver::Error> {
    Version::parse(version.trim_start_matches('v'))
}

/// Returns the newest non-draft release that parses as the current major version.
fn latest_current_major_release(
    releases: Vec<ReleaseInfo>,
    current_major: u64,
) -> Option<(Version, ReleaseInfo)> {
    let mut matching_releases = releases
        .into_iter()
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
        let latest = latest_current_major_release(
            vec![
                release("4.0.0-alpha.1"),
                release("5.0.0-alpha.1"),
                release("4.0.0-beta.1"),
                release("4.0.0-beta.2"),
            ],
            4,
        )
        .expect("current major release should be found");

        assert_eq!(latest.0, parse_version("4.0.0-beta.2").unwrap());
        assert_eq!(latest.1.tag_name, "4.0.0-beta.2");
    }
}
