//! Release tag parsing and update candidate selection.

use anyhow::Result;
use log::warn;
use semver::Version;

use super::github::GithubRelease;

/// Parses a GitHub release tag as a semantic version.
pub fn parse_version(version: &str) -> Result<Version, semver::Error> {
    Version::parse(version.trim_start_matches('v'))
}

/// Finds the non-draft release matching the current application version.
pub fn current_release<'a>(
    releases: &'a [GithubRelease],
    current_version: &Version,
) -> Option<&'a GithubRelease> {
    releases.iter().find(|release| {
        !release.draft
            && parse_version(&release.tag_name)
                .ok()
                .is_some_and(|version| version == *current_version)
    })
}

/// Result of scanning one GitHub release page for an update candidate.
pub enum FindCandidateOutcome {
    /// Found the newest allowed release in this page for the current major version.
    Found(Version, GithubRelease),
    /// Reached the previous major version's release history without finding a candidate.
    ReachedPreviousMajor,
    /// No candidate found; later pages may still contain one.
    Continue,
}

/// Finds the newest allowed update candidate in one GitHub release page.
pub fn find_update_candidate(
    releases: Vec<GithubRelease>,
    current_major: u64,
    include_github_prereleases: bool,
) -> FindCandidateOutcome {
    let mut latest = None;
    let mut reached_previous_major = false;

    for release in releases {
        if release.draft {
            continue;
        }

        let version = match parse_version(&release.tag_name).inspect_err(|err| {
            warn!(
                "Failed to parse GitHub release version '{}': {err}",
                release.tag_name
            );
        }) {
            Ok(version) => version,
            Err(_) => continue,
        };

        let is_previous_major = current_major
            .checked_sub(1)
            .is_some_and(|previous_major| version.major == previous_major);
        if is_previous_major {
            reached_previous_major = true;
            continue;
        }

        if version.major != current_major {
            continue;
        }

        if release.prerelease && !include_github_prereleases {
            continue;
        }

        let replace_latest = latest
            .as_ref()
            .is_none_or(|(latest_version, _)| version > *latest_version);
        if replace_latest {
            latest = Some((version, release));
        }
    }

    if let Some((version, release)) = latest {
        FindCandidateOutcome::Found(version, release)
    } else if reached_previous_major {
        FindCandidateOutcome::ReachedPreviousMajor
    } else {
        FindCandidateOutcome::Continue
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn release(tag_name: &str) -> GithubRelease {
        release_with_prerelease(tag_name, false)
    }

    fn release_with_prerelease(tag_name: &str, prerelease: bool) -> GithubRelease {
        GithubRelease {
            tag_name: tag_name.into(),
            body: None,
            html_url: String::from("https://example.com/release"),
            draft: false,
            prerelease,
            assets: Vec::new(),
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

    fn found(outcome: FindCandidateOutcome) -> (Version, GithubRelease) {
        match outcome {
            FindCandidateOutcome::Found(version, release) => (version, release),
            FindCandidateOutcome::ReachedPreviousMajor | FindCandidateOutcome::Continue => {
                panic!("update candidate should be found")
            }
        }
    }

    #[test]
    fn find_update_candidate_sorts_allowed_versions_by_semver() {
        let releases = vec![
            release("4.0.0-alpha.1"),
            release("5.0.0-alpha.1"),
            release("4.0.0-beta.1"),
            release("4.0.0-beta.2"),
        ];
        let selected = found(find_update_candidate(releases, 4, true));

        assert_eq!(selected.0, parse_version("4.0.0-beta.2").unwrap());
        assert_eq!(selected.1.tag_name, "4.0.0-beta.2");
    }

    #[test]
    fn find_update_candidate_excludes_github_prereleases_when_disabled() {
        let releases = vec![
            release_with_prerelease("4.0.1", false),
            release_with_prerelease("4.1.0", true),
        ];
        let selected = found(find_update_candidate(releases, 4, false));

        assert_eq!(selected.0, parse_version("4.0.1").unwrap());
        assert_eq!(selected.1.tag_name, "4.0.1");
    }

    #[test]
    fn find_update_candidate_does_not_filter_by_semver_prerelease() {
        let releases = vec![release("4.0.1"), release("4.1.0-beta.1")];
        let selected = found(find_update_candidate(releases, 4, false));

        assert_eq!(selected.0, parse_version("4.1.0-beta.1").unwrap());
        assert_eq!(selected.1.tag_name, "4.1.0-beta.1");
    }

    #[test]
    fn find_update_candidate_includes_github_prereleases_when_enabled() {
        let releases = vec![
            release_with_prerelease("4.0.1", false),
            release_with_prerelease("4.1.0", true),
        ];
        let selected = found(find_update_candidate(releases, 4, true));

        assert_eq!(selected.0, parse_version("4.1.0").unwrap());
        assert_eq!(selected.1.tag_name, "4.1.0");
    }

    #[test]
    fn find_update_candidate_prefers_found_candidate_over_previous_major() {
        let releases = vec![release("4.0.1"), release("3.9.0")];
        let selected = found(find_update_candidate(releases, 4, false));

        assert_eq!(selected.1.tag_name, "4.0.1");
    }

    #[test]
    fn find_update_candidate_stops_at_previous_major_without_candidate() {
        let releases = vec![release("3.9.0")];
        let outcome = find_update_candidate(releases, 4, false);

        assert!(matches!(
            outcome,
            FindCandidateOutcome::ReachedPreviousMajor
        ));
    }

    #[test]
    fn current_release_matches_exact_version() {
        let releases = vec![release("4.0.0"), release("4.0.1")];
        let current_version = parse_version("4.0.1").unwrap();

        let current = current_release(&releases, &current_version)
            .expect("exact current version release should be found");

        assert_eq!(current.tag_name, "4.0.1");
    }
}
