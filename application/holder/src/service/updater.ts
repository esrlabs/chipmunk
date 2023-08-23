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

import * as path from 'path';
import * as fs from 'fs';
import * as Events from 'platform/ipc/event';
import * as Requests from 'platform/ipc/request';

declare const global: ChipmunkGlobal;

const UPDATER = 'updater';
const AUTO = { key: 'autoUpdateCheck', path: 'general' };

export const REPO = 'chipmunk';
export const TARGET_TAG_STARTS = 'next-';

enum LatestReleaseNotFound {
    NoUpdates,
    NoNextGeneration,
    Skipped,
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
        night(): Promise<{ release: IReleaseData; version: Version } | undefined>;
        latest(): Promise<{ release: IReleaseData; version: Version } | LatestReleaseNotFound>;
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
            night: async (): Promise<{ release: IReleaseData; version: Version } | undefined> => {
                if (this.find(force).skiping()) {
                    return undefined;
                }
                const github = new GitHubClient();
                const releases: IReleaseData[] = await github.getReleases({ repo: REPO });
                const current: Version = new Version(version.getVersion());
                let candidate: { release: IReleaseData; version: Version } | undefined;
                releases.forEach((release: IReleaseData) => {
                    if (!release.name.toLowerCase().includes(TARGET_TAG_STARTS)) {
                        return;
                    }
                    try {
                        const version = new Version(release.name, TARGET_TAG_STARTS);
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
            latest: async (): Promise<
                { release: IReleaseData; version: Version } | LatestReleaseNotFound
            > => {
                if (this.find(force).skiping()) {
                    return LatestReleaseNotFound.Skipped;
                }
                const github = new GitHubClient();
                const latest: IReleaseData = await github.getLatestRelease({ repo: REPO });
                if (!latest.name.toLowerCase().includes(TARGET_TAG_STARTS)) {
                    this.log().warn(
                        `Found release "${latest.name} (tag: ${latest.tag_name})", but this is not NEXT-series release`,
                    );
                    return LatestReleaseNotFound.NoNextGeneration;
                }
                const current: Version = new Version(version.getVersion());
                let candidate: { release: IReleaseData; version: Version } | undefined;
                try {
                    const version = new Version(latest.name, TARGET_TAG_STARTS);
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
                const latest = await this.find(force).latest();
                if (latest === LatestReleaseNotFound.NoUpdates) {
                    this.log().debug(`No updates has been found in latest release.`);
                    return Promise.resolve(`No updates has been found.`);
                } else if (latest === LatestReleaseNotFound.Skipped) {
                    return Promise.resolve(this.log().debug(`Checking of updates is skipped`));
                } else if (latest === LatestReleaseNotFound.NoNextGeneration) {
                    this.log().debug(`Updates aren't found in latest. Will look in pre-releases`);
                }
                const prerelease = await this.find(force).night();
                if (prerelease === undefined) {
                    this.log().debug(`No updates has been found in pre-releases.`);
                    return Promise.resolve(`No updates has been found.`);
                }
                this.log().debug(`New version has been found: ${prerelease.release.name}`);
                const release: ReleaseFile = new ReleaseFile(
                    prerelease.release.name,
                    TARGET_TAG_STARTS,
                );
                this.log().debug(`Looking for: ${release.filename}`);
                let compressed: string | undefined;
                prerelease.release.assets.forEach((asset: IReleaseAsset) => {
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
                return { release: prerelease.release, version: prerelease.version, compressed };
            },
        };
    }

    public async check(force: boolean): Promise<void> {
        const candidate = await this.find(force).candidate();
        if (typeof candidate === 'string') {
            this.log().debug(`No updates has been found.`);
            return Promise.resolve();
        }
        const release: ReleaseFile = new ReleaseFile(candidate.release.name, TARGET_TAG_STARTS);
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
        notifications.send(`New version (${this.candidate.release.name}) is available`, [
            {
                action: {
                    uuid: unique(),
                    name: 'Restart & Update',
                    description: `Update to ${this.candidate.release.name}`,
                },
                handler: () => {
                    return this._delivery().then((updater: string) => {
                        global.application
                            .shutdown('Updating')
                            .update(new Update(updater, filename, paths.getExec(true)))
                            .catch((err: Error) => {
                                this.log().error(`Fail to trigger updating; error: ${err.message}`);
                            });
                    });
                },
            },
            {
                action: {
                    uuid: unique(),
                    name: 'Cancel',
                    description: `Update to ${(candidate.release as IReleaseData).name}`,
                },
                handler: () => Promise.resolve(),
            },
        ]);
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
