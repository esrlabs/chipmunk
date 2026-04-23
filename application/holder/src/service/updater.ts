import {
    SetupService,
    Interface,
    Implementation,
    register,
    DependOn,
} from 'platform/entity/service';
import { services } from '@register/services';
import { paths } from '@service/paths';
import { settings } from '@service/settings';
import { production } from '@service/production';
import { notifications } from '@service/notifications';
import { storage } from '@service/storage';
import { GitHubClient, IReleaseData, IReleaseAsset } from '@module/github';
import { Version } from './updater/version';
import { ReleaseFile } from './updater/releasefile';
import { version } from '@module/version';
import { error } from 'platform/log/utils';
import { getExecutable } from '@env/os/platform';
import { unique } from 'platform/env/sequence';
import { ChipmunkGlobal } from '@register/global';
import { exists } from '@env/fs';
import { Update } from '@loader/exitcases/update';
import { electron } from '@service/electron';
import { CancelablePromise } from 'platform/env/promise';
import { getCustomPlatform } from './updater/metadata';
import { getAlphaRelease, getLatestAlphaRelease } from './updater/alpha';

import * as path from 'path';
import * as fs from 'fs';
import { shell } from 'electron';
import * as Events from 'platform/ipc/event';
import * as Requests from 'platform/ipc/request';

declare const global: ChipmunkGlobal;

const UPDATER = 'updater';
const AUTO = { key: 'autoUpdateCheck', path: 'general' };
const PRERELEASE = { key: 'allowUpdateFromPrerelease', path: 'general' };
// Internal storage for the last alpha tag we already announced in the UI.
const ALPHA_RELEASE_NOTIFICATION_STATE_KEY = 'updater_alpha';
const ALPHA_RELEASE_NOTIFICATION_ENTRY = 'last_announced_alpha_tag';

export const REPO = 'chipmunk';

export function getVersionPrefix(ver: string): string {
    return ver
        .toLocaleLowerCase()
        .replace(/-?\d{1,}\.\d{1,}\.\d{1,}/gi, '')
        .trim();
}

export function getCleanVersion(ver: string): string {
    const prefix = getVersionPrefix(ver);
    return ver.toLocaleLowerCase().replace(prefix, '').replace(/-/gi, '').trim();
}

enum LatestReleaseNotFound {
    NoUpdates,
    Skipped,
}

// Keep updater decision-making explicit. The old string-only result was fine for the
// manual dialog, but too ambiguous once the automatic flow also needed alpha fallback.
enum CandidateResultState {
    Candidate,
    NoUpdates,
    Skipped,
    Unavailable,
    Alpha,
}

interface ICandidate {
    release: IReleaseData;
    version: Version;
}

interface IDownloadCandidate extends ICandidate {
    compressed: string;
}

interface ICandidateResult {
    state: CandidateResultState;
    candidate?: IDownloadCandidate;
    report: string;
}

@DependOn(paths)
@DependOn(settings)
@DependOn(notifications)
@DependOn(storage)
@DependOn(electron)
@SetupService(services['updater'])
export class Service extends Implementation {
    protected candidate:
        | {
              release: IReleaseData;
              filename: string;
          }
        | undefined;
    public override ready(): Promise<void> {
        this.register(
            Events.IpcEvent.subscribe(
                Events.State.Client.Event,
                (/*_event: Events.State.Client.Event*/) => {
                    this.check(false).catch((error: Error) => {
                        this.log().warn(`Fail to check updates due error: ${error.message}`);
                    });
                },
            ),
        );
        this.register(
            electron
                .ipc()
                .respondent(
                    this.getName(),
                    Requests.System.CheckUpdates.Request,
                    (
                        _request: Requests.System.CheckUpdates.Request,
                    ): CancelablePromise<Requests.System.CheckUpdates.Request> => {
                        return new CancelablePromise((resolve) => {
                            this.find(true)
                                .candidate(true)
                                .then((candidate) => {
                                    resolve(
                                        new Requests.System.CheckUpdates.Response({
                                            report:
                                                typeof candidate === 'string'
                                                    ? candidate
                                                    : `Found release ${candidate.release.name}. Downloading is started`,
                                        }),
                                    );
                                })
                                .catch((error: Error) => {
                                    resolve(
                                        new Requests.System.CheckUpdates.Response({
                                            error: error.message,
                                        }),
                                    );
                                    this.log().warn(
                                        `Fail to check updates due error: ${error.message}`,
                                    );
                                });
                        });
                    },
                ),
        );
        return Promise.resolve();
    }

    protected find(force: boolean): {
        skiping(): boolean;
        night(): Promise<ICandidate | undefined>;
        latest(): Promise<ICandidate | LatestReleaseNotFound>;
        result(reportAlphaInsteadOfDownload?: boolean): Promise<ICandidateResult>;
        candidate(reportAlphaInsteadOfDownload?: boolean): Promise<IDownloadCandidate | string>;
    } {
        // `result()` is the internal API used by the automatic flow.
        // `candidate()` keeps the older manual-check contract unchanged.
        return {
            skiping: (): boolean => {
                const auto = settings.get().value<boolean>(AUTO.path, AUTO.key);
                if (!auto && !force) {
                    this.log().debug(`Checking of updates is skipped.`);
                    return true;
                }
                if (!production.isProduction()) {
                    this.log().debug(`Checking of updates is skipped because production is OFF.`);
                    return true;
                }
                return false;
            },
            night: async (): Promise<ICandidate | undefined> => {
                if (this.find(force).skiping()) {
                    return undefined;
                }
                const github = new GitHubClient();
                const releases: IReleaseData[] = await github.getReleases({ repo: REPO });
                const current: Version = new Version(version.getVersion());
                let candidate: ICandidate | undefined;
                releases.forEach((release: IReleaseData) => {
                    try {
                        const version = new Version(getCleanVersion(release.name));
                        if (current.isGivenGrander(version)) {
                            if (
                                candidate !== undefined &&
                                !candidate.version.isGivenGrander(version)
                            ) {
                                this.log().debug(
                                    `Release "${release.name} (tag: ${release.tag_name})", ignored, because candidate ${candidate.release.tag_name}`,
                                );
                                return;
                            }
                            candidate = {
                                release,
                                version,
                            };
                        }
                    } catch (err) {
                        this.log().warn(
                            `Found release "${release.name} (tag: ${
                                release.tag_name
                            })", but version isn't valid: ${error(err)}`,
                        );
                    }
                });
                return candidate;
            },
            latest: async (): Promise<ICandidate | LatestReleaseNotFound> => {
                if (this.find(force).skiping()) {
                    return LatestReleaseNotFound.Skipped;
                }
                const github = new GitHubClient();
                const latest: IReleaseData = await github.getLatestRelease({ repo: REPO });
                const prefix: string = getVersionPrefix(latest.name);
                if (prefix !== '') {
                    this.log().debug(
                        `Found release "${latest.name} (tag: ${latest.tag_name})" with prefix "${prefix}"`,
                    );
                }
                const current: Version = new Version(version.getVersion());
                let candidate: ICandidate | undefined;
                try {
                    const version = new Version(getCleanVersion(latest.name));
                    if (current.isGivenGrander(version)) {
                        if (candidate !== undefined && !candidate.version.isGivenGrander(version)) {
                            this.log().debug(
                                `Release "${latest.name} (tag: ${latest.tag_name})", ignored, because candidate ${candidate.release.tag_name}`,
                            );
                            return LatestReleaseNotFound.NoUpdates;
                        }
                        candidate = {
                            release: latest,
                            version,
                        };
                    }
                } catch (err) {
                    this.log().warn(
                        `Found release "${latest.name} (tag: ${
                            latest.tag_name
                        })", but version isn't valid: ${error(err)}`,
                    );
                }
                return candidate === undefined ? LatestReleaseNotFound.NoUpdates : candidate;
            },
            result: async (reportAlphaInsteadOfDownload = false): Promise<ICandidateResult> => {
                let candidate: ICandidate | undefined;
                const latest = await this.find(force).latest();
                if (latest === LatestReleaseNotFound.NoUpdates) {
                    const night = settings.get().value<boolean>(PRERELEASE.path, PRERELEASE.key);
                    if (!night) {
                        this.log().debug(`No updates has been found in latest release.`);
                    } else {
                        this.log().debug(
                            `No updates has been found in latest release. Checking pre-releases`,
                        );
                        candidate = await this.find(force).night();
                    }
                } else if (latest === LatestReleaseNotFound.Skipped) {
                    return {
                        state: CandidateResultState.Skipped,
                        report: `Checking of updates is skipped`,
                    };
                } else {
                    candidate = latest;
                }
                if (candidate === undefined) {
                    const alphaReport = reportAlphaInsteadOfDownload
                        ? await this._getManualAlphaReleaseReport()
                        : undefined;
                    if (alphaReport !== undefined) {
                        return {
                            state: CandidateResultState.Alpha,
                            report: alphaReport,
                        };
                    }
                    this.log().debug(`No updates has been found.`);
                    return {
                        state: CandidateResultState.NoUpdates,
                        report: `No updates has been found.`,
                    };
                }
                if (reportAlphaInsteadOfDownload) {
                    const alphaRelease = getAlphaRelease(candidate.release);
                    if (alphaRelease !== undefined) {
                        return {
                            state: CandidateResultState.Alpha,
                            report: this._getManualAlphaReleaseReportText(),
                        };
                    }
                }
                const customPlatform = await getCustomPlatform();

                const release: ReleaseFile = new ReleaseFile(
                    getCleanVersion(candidate.release.name),
                    getVersionPrefix(candidate.release.name),
                    customPlatform,
                );
                this.log().debug(`Looking for: ${release.filename}`);
                let compressed: string | undefined;
                candidate.release.assets.forEach((asset: IReleaseAsset) => {
                    if (release.equal(asset.name)) {
                        compressed = asset.name;
                    }
                });
                if (compressed === undefined) {
                    this.log().warn(`Fail to find archive-file with release for current platform. `);
                    return {
                        state: CandidateResultState.Unavailable,
                        report: `Fail to find archive-file with release for current platform. `,
                    };
                }
                return {
                    state: CandidateResultState.Candidate,
                    report: `Found release ${candidate.release.name}. Downloading is started`,
                    candidate: {
                        release: candidate.release,
                        version: candidate.version,
                        compressed,
                    },
                };
            },
            candidate: async (
                reportAlphaInsteadOfDownload = false,
            ): Promise<IDownloadCandidate | string> => {
                const result = await this.find(force).result(reportAlphaInsteadOfDownload);
                return result.state === CandidateResultState.Candidate && result.candidate !== undefined
                    ? result.candidate
                    : result.report;
            },
        };
    }

    public async check(force: boolean): Promise<void> {
        const result = await this.find(force).result();
        if (result.state !== CandidateResultState.Candidate || result.candidate === undefined) {
            // Alpha announcements are automatic-check only and must never compete with a real
            // updater candidate, including the testing prerelease path.
            if (!force && result.state === CandidateResultState.NoUpdates) {
                await this._checkForAlphaReleaseAnnouncement();
            }
            return Promise.resolve();
        }

        const candidate = result.candidate;
        const customPlatform = await getCustomPlatform();
        const release: ReleaseFile = new ReleaseFile(
            getCleanVersion(candidate.release.name),
            getVersionPrefix(candidate.release.name),
            customPlatform,
        );
        const filename: string = path.resolve(paths.getDownloads(), candidate.compressed);
        if (fs.existsSync(filename)) {
            // File was already downloaded
            this.log().debug(
                `File was already downloaded "${filename}". latest: ${candidate.release.tag_name}.`,
            );
            this.candidate = {
                release: candidate.release,
                filename,
            };
        } else {
            this.log().debug(
                `Found new version "${candidate.release.tag_name}". Starting downloading: ${release.filename}.`,
            );
            const github = new GitHubClient();
            const filename: string = await github.download(
                {
                    repo: REPO,
                },
                {
                    version: candidate.release.name,
                    name: release.filename,
                    dest: paths.getDownloads(),
                },
            );
            this.log().debug(`File ${release.filename} is downloaded into: ${filename}.`);
            this.candidate = {
                release: candidate.release as IReleaseData,
                filename,
            };
        }
        // Check folder access
        const hasAccess = this.checkFolderAccess();
        this.log().debug(`Chipmunk location sufficiently accessible for update : ${hasAccess}.`);
        notifications.send(
            `New version (${this.candidate.release.name}) is available${
                !hasAccess ? '; insufficient access to update' : ''
            }`,
            [
                {
                    action: {
                        uuid: unique(),
                        name: 'Restart & Update',
                        description: !hasAccess
                            ? `Unable to update`
                            : `Update to ${this.candidate.release.name}`,
                        disabled: !hasAccess,
                    },
                    handler: () => {
                        if (!hasAccess) {
                            return Promise.reject(new Error('No access to the current folder'));
                        }
                        return this._delivery().then((updater: string) => {
                            global.application
                                .shutdown('Updating')
                                .update(new Update(updater, filename, paths.getExec(true)))
                                .catch((err: Error) => {
                                    this.log().error(
                                        `Fail to trigger updating; error: ${err.message}`,
                                    );
                                });
                        });
                    },
                },
                {
                    action: {
                        uuid: unique(),
                        name: 'Cancel',
                        description: '',
                        disabled: false,
                    },
                    handler: () => Promise.resolve(),
                },
            ],
        );
    }

    private async _checkForAlphaReleaseAnnouncement(): Promise<void> {
        const github = new GitHubClient();
        const releases = await github.getReleases({ repo: REPO });
        const latestAlpha = getLatestAlphaRelease(releases);
        // This branch never downloads assets. It only advertises the separate 4.0.0 alpha track.
        if (latestAlpha === undefined) {
            return;
        }
        const lastAnnouncedTag = await this._getLastAnnouncedAlphaTag();
        if (lastAnnouncedTag === latestAlpha.tag) {
            return;
        }
        const releasePageUrl = latestAlpha.release.html_url;
        notifications.send(
            `Chipmunk's next major release is now in alpha.`,
            [
                {
                    action: {
                        uuid: unique(),
                        name: 'Open Release Page',
                        description: releasePageUrl,
                        disabled: false,
                    },
                    handler: () => {
                        return shell.openExternal(releasePageUrl);
                    },
                },
                {
                    action: {
                        uuid: unique(),
                        name: 'Dismiss',
                        description: '',
                        disabled: false,
                    },
                    handler: () => Promise.resolve(),
                },
            ],
        );
        await this._setLastAnnouncedAlphaTag(latestAlpha.tag);
    }

    private async _getManualAlphaReleaseReport(): Promise<string | undefined> {
        const github = new GitHubClient();
        const releases = await github.getReleases({ repo: REPO });
        const latestAlpha = getLatestAlphaRelease(releases);
        if (latestAlpha === undefined) {
            return undefined;
        }
        return this._getManualAlphaReleaseReportText();
    }

    private _getManualAlphaReleaseReportText(): string {
        return 'The next major release of Chipmunk is available as an alpha release.\nPlease download it manually from the Chipmunk GitHub releases page.';
    }

    private async _getLastAnnouncedAlphaTag(): Promise<string | undefined> {
        try {
            const entries = await storage.entries.get(ALPHA_RELEASE_NOTIFICATION_STATE_KEY);
            return entries.get(ALPHA_RELEASE_NOTIFICATION_ENTRY)?.content;
        } catch (_err) {
            // Missing state just means nothing has been announced yet.
            return undefined;
        }
    }

    private async _setLastAnnouncedAlphaTag(tag: string): Promise<void> {
        try {
            await storage.entries.overwrite(ALPHA_RELEASE_NOTIFICATION_STATE_KEY, [
                {
                    uuid: ALPHA_RELEASE_NOTIFICATION_ENTRY,
                    content: tag,
                },
            ]);
        } catch (err) {
            this.log().warn(`Fail to save alpha release notification state: ${error(err)}`);
        }
    }

    // Function to check access to the current folder
    private checkFolderAccess(): boolean {
        try {
            fs.accessSync(
                paths.getExec(true),
                fs.constants.R_OK | fs.constants.W_OK | fs.constants.X_OK,
            );
            return true;
        } catch (_err) {
            return false;
        }
    }

    private async _delivery(): Promise<string> {
        const updater = {
            src: path.resolve(paths.getBin(), getExecutable(UPDATER)),
            dest: path.resolve(paths.getApps(), getExecutable(UPDATER)),
        };
        this.log().debug(`Updater will be copied from ${updater.src} to ${updater.dest}`);
        if (!(await exists(updater.src))) {
            throw new Error(`Fail to find updater: ${updater.src}`);
        }
        if (fs.existsSync(updater.dest)) {
            await fs.promises.unlink(updater.dest);
        }
        await fs.promises.copyFile(updater.src, updater.dest);
        this.log().debug(`Updater has beed copied from ${updater.src} to ${updater.dest}`);
        return updater.dest;
    }
}

export interface Service extends Interface {}
export const updater = register(new Service());
