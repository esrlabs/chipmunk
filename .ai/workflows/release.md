# Release Workflow

## Overview

A release ships the GUI application and the CLI tool together from one version tag.
The tag triggers CI, which publishes a GitHub pre-release with the build artifacts.
The pre-release is promoted to the latest release only after it has been tested, because promotion is what notifies users through the in-app updater.

## Remotes and Roles

The steps below assume the following setup. Adapt the remote names if the local setup differs.

- `origin`: maintainer fork. Release branches and pull requests start here.
- `upstream` (`esrlabs/chipmunk`): main repository. Tags, releases, and release notes live here.

## Agent Boundaries

An agent prepares content only: version bumps, `Cargo.lock` refresh, changelog entries, and the release notes text.

Agents do not commit, push, tag, or touch GitHub releases. Every git and GitHub step in this workflow belongs to the maintainer.
For those steps, propose the exact commands to run instead of running them. This applies to tagging in particular, where a wrong or premature tag immediately starts the release CI.

## 1. Release Branch

Create a branch on the fork named after the version, for example `release-4-4-0`.
Commit and pull request title follow the existing convention: `Up to Version <X.Y.Z>`. No description is needed.

## 2. Version Bumps

- GUI and workspace crates: `version` under `[workspace.package]` in the root `Cargo.toml`.
- CLI: `version` in `crates/cli/Cargo.toml`. The CLI is versioned independently and is bumped only when it changed.
- Refresh `Cargo.lock` by running any cargo command that resolves the workspace, for example `cargo check`.

## 3. Changelogs

Two changelogs are maintained:

- `changelog.md` (repository root): the user-facing GUI changelog. It is also the source for release notes and is presented to users inside the application.
- `crates/cli/CHANGELOG.md`: the CLI changelog.

Format used by both: a version heading `# <X.Y.Z> (DD.MM.YYYY)`, followed by `## Features`, `## Changes`, and `## Fixes` sections, including only the sections that apply.

Writing rules:

- Write for users, not for developers. Describe observable behavior, not implementation.
- Read the previous entries before writing. They define the expected tone, level of detail, and phrasing.
- Group several small related changes into one entry instead of listing every commit.
- When the CLI version changed, mention it in the main changelog as part of the relevant entry, including the new CLI version number.

## 4. Pull Request

Open the pull request against `upstream/master` and merge it once the checks pass.

## 5. Tag and Release CI

Create the tag on `master` in the upstream repository. Tag names are the bare version, for example `4.4.0`, with no prefix.

`.github/workflows/release.yml` runs on any pushed tag and:

- creates a GitHub release named after the tag, marked as a pre-release,
- builds on Linux, Windows, and both macOS architectures, with signing and notarization on macOS,
- uploads the portable archives and the installers (`.tgz`, `.deb`, `.rpm`, `.msi`, `.pkg`) to the release.

## 6. Pre-Release Testing

Every tag produces a pre-release, and it stays one until it has been tested. In that window the build is published with all its artifacts, but the updater does not offer it to users.

How the updater picks a release, which is what makes this window possible:

- On startup the application fetches the most recent releases of `esrlabs/chipmunk` from the GitHub API.
- Draft releases are always ignored. Pre-releases are ignored as well, unless the user enabled the `Check pre-releases` option in the application update settings, which is off by default and only available while update checks are enabled.
- Only releases with the same major version as the running application are offered as updates.
- Implementation: `crates/app/src/host/service/update/`.

Anyone who enables that option updates to the pre-release like a normal user would. This is what the window is for: the new build, its artifacts, and the update path itself are exercised in their real form while users are still on the previous version.

Testing therefore belongs after the workflow finished and its artifacts are attached, and before promotion. Writing the release notes first (step 7) puts them into the same test, since they are shown by the update that is being tested.

## 7. Release Notes

The release notes are the user-facing text of the release. The application fetches the notes of the release whose tag matches the running version and shows them, rendered as markdown, on the first start after an update.

They are shown once. A user who has already started the new version will not see them again, so editing the notes after promotion does not reach them. The notes must be correct before promotion.

Compose them from `changelog.md`:

1. Copy the section of the version being released as it is, including its heading with the version and date.
2. Append the sections of a few previous releases below it, each with its headings demoted by one level (`#` becomes `##`, `##` becomes `###`), so the released version remains the only top-level heading. This gives users who skipped versions the changes they missed.
3. Keep to plain markdown: headings, bullet lists, inline code, and bold. The in-app viewer is not GitHub, so avoid raw HTML and GitHub-specific syntax.

When in doubt, open the previous releases on GitHub next to `changelog.md` and compare them. The difference between the two shows exactly how much history is usually included and how the headings are shifted.

## 8. Promotion

Promotion is the step that makes the release public to the updater. Before doing it, confirm the release notes are final and the build passed the tests from step 6.

1. On the GitHub release, remove the pre-release mark and set it as the latest release.
2. From this moment the updater offers the version to every user who has update checks enabled, without the pre-release option.

## Recovering From a Failed Release

If the release workflow fails or a problem is found while the release is still a pre-release:

1. Delete the release on GitHub.
2. Delete the tag on GitHub.
3. Land the fixes and push a new tag.

Fixes are usually committed directly, without a dedicated pull request, unless they are large enough to warrant a review.
