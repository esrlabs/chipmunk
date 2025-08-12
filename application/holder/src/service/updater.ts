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

import * as path from 'path';
import * as fs from 'fs';
import * as Events from 'platform/ipc/event';
import * as Requests from 'platform/ipc/request';

declare const global: ChipmunkGlobal;

const UPDATER = 'updater';
const AUTO = { key: 'autoUpdateCheck', path: 'general' };
const PRERELEASE = { key: 'allowUpdateFromPrerelease', path: 'general' };

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

interface ICandidate {
    release: IReleaseData;
    version: Version;
}

@DependOn(paths)
@DependOn(settings)
@DependOn(notifications)
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
                            this.find(false)
                                .candidate()
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
        candidate(): Promise<
            { release: IReleaseData; version: Version; compressed: string } | string
        >;
    } {
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
            candidate: async (): Promise<
                { release: IReleaseData; version: Version; compressed: string } | string
            > => {
                let candidate: ICandidate | undefined;
                const latest = await this.find(force).latest();
                if (latest === LatestReleaseNotFound.NoUpdates) {
                    const night = settings.get().value<boolean>(PRERELEASE.path, PRERELEASE.key);
                    if (!night) {
                        this.log().debug(`No updates has been found in latest release.`);
                        return Promise.resolve(`No updates has been found.`);
                    } else {
                        this.log().debug(
                            `No updates has been found in latest release. Checking pre-releases`,
                        );
                        candidate = await this.find(force).night();
                    }
                } else if (latest === LatestReleaseNotFound.Skipped) {
                    return Promise.resolve(this.log().debug(`Checking of updates is skipped`));
                } else {
                    candidate = latest;
                }
                if (candidate === undefined) {
                    return Promise.resolve(this.log().debug(`No updates has been found.`));
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
                    this.log().warn(
                        `Fail to find archive-file with release for current platform. `,
                    );
                    return Promise.resolve(
                        `Fail to find archive-file with release for current platform. `,
                    );
                }
                return {
                    release: candidate.release,
                    version: candidate.version,
                    compressed,
                };
            },
        };
    }

    public async check(force: boolean): Promise<void> {
        const candidate = await this.find(force).candidate();
        if (typeof candidate === 'string') {
            this.log().debug(`No updates has been found.`);
            return Promise.resolve();
        }

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
                        disabled: !hasAccess, // Disable the button if access is not available
                    },
                    handler: () => {
                        if (!hasAccess)
                            return Promise.reject(new Error('No access to the current folder'));
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
