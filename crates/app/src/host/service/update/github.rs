//! GitHub release API boundary for update checks.

use anyhow::Result;
use serde::Deserialize;

const OWNER: &str = "esrlabs";
const REPO: &str = "chipmunk";
/// Maximum number of GitHub releases fetched for one update check.
pub const RELEASES_LIMIT: usize = 10;
const USER_AGENT: &str = "chipmunk";

#[derive(Debug, Deserialize)]
/// GitHub release metadata used by update checks.
pub struct GithubRelease {
    /// Git tag associated with the release.
    pub tag_name: String,
    /// Markdown release notes.
    pub body: Option<String>,
    /// Browser URL for the GitHub release page.
    pub html_url: String,
    /// Whether the GitHub release is still a draft.
    pub draft: bool,
    /// Whether GitHub marks this release as a pre-release.
    pub prerelease: bool,
    /// Assets attached to the GitHub release.
    #[serde(default)]
    pub assets: Vec<GithubAsset>,
}

#[derive(Clone, Debug, Deserialize)]
/// GitHub release asset metadata used for update matching.
pub struct GithubAsset {
    /// Published asset file name.
    pub name: String,
    /// Direct download URL for the asset.
    pub browser_download_url: String,
}

/// Fetches one page of published releases from GitHub.
pub async fn fetch_releases_page(page: usize) -> Result<Vec<GithubRelease>> {
    let client = reqwest::Client::new();
    let url = format!(
        "https://api.github.com/repos/{OWNER}/{REPO}/releases?per_page={RELEASES_LIMIT}&page={page}"
    );

    let response = client
        .get(url)
        .header(reqwest::header::USER_AGENT, USER_AGENT)
        .send()
        .await?
        .error_for_status()?;

    Ok(response.json().await?)
}
