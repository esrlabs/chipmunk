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
import { error } from 'platform/env/logger';
import { getExecutable } from '@env/os/platform';
import { unique } from 'platform/env/sequence';
import { ChipmunkGlobal } from '@register/global';
import { exists } from '@env/fs';
import { Update } from '@loader/exitcases/update';

import * as path from 'path';
import * as fs from 'fs';
import * as Events from 'platform/ipc/event';

declare const global: ChipmunkGlobal;

const UPDATER = 'updater';
const AUTO = { key: 'autoUpdateCheck', path: 'general' };
const REPO = 'chipmunk';
const TARGET_TAG_STARTS = 'next-';

@DependOn(paths)
@DependOn(settings)
@DependOn(notifications)
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
        return Promise.resolve();
    }

    public async check(force: boolean): Promise<void> {
        const auto = settings.get<boolean>(AUTO.path, AUTO.key);
        if (!auto && !force) {
            this.log().debug(`Checking of updates is skipped.`);
            return Promise.resolve();
        }
        if (!production.isProduction()) {
            this.log().debug(`Checking of updates is skipped because production is OFF.`);
            return Promise.resolve();
        }
        const github = new GitHubClient();
        const releases: IReleaseData[] = await github.getReleases({ repo: REPO });
        const current: Version = new Version(version.getVersion());
        let candidate: IReleaseData | undefined;
        releases.forEach((release: IReleaseData) => {
            if (!release.name.toLowerCase().includes(TARGET_TAG_STARTS)) {
                return;
            }
            try {
                const version = new Version(release.name, TARGET_TAG_STARTS);
                if (current.isGivenGrander(version)) {
                    candidate = release;
                }
            } catch (err) {
                this.log().warn(
                    `Found release "${release.name} (tag: ${
                        release.tag_name
                    })", but version isn't valid: ${error(err)}`,
                );
            }
        });
        if (candidate === undefined) {
            this.log().debug(`No updates has been found.`);
            return Promise.resolve();
        }
        this.log().debug(`New version has been found: ${candidate.name}`);
        const release: ReleaseFile = new ReleaseFile(candidate.name, TARGET_TAG_STARTS);
        this.log().debug(`Looking for: ${release.filename}`);
        let compressed: string | undefined;
        candidate.assets.forEach((asset: IReleaseAsset) => {
            if (release.equal(asset.name)) {
                compressed = asset.name;
            }
        });
        if (compressed === undefined) {
            this.log().warn(`Fail to find archive-file with release for current platform. `);
            return Promise.resolve();
        }
        const filename: string = path.resolve(paths.getDownloads(), compressed);
        if (fs.existsSync(filename)) {
            // File was already downloaded
            this.log().debug(
                `File was already downloaded "${filename}". latest: ${candidate.tag_name}.`,
            );
            this.candidate = {
                release: candidate,
                filename,
            };
        } else {
            this.log().debug(
                `Found new version "${candidate.tag_name}". Starting downloading: ${release.filename}.`,
            );
            const filename: string = await github.download(
                {
                    repo: REPO,
                },
                {
                    version: candidate.name,
                    name: release.filename,
                    dest: paths.getDownloads(),
                },
            );
            this.log().debug(`File ${release.filename} is downloaded into: ${filename}.`);
            this.candidate = {
                release: candidate as IReleaseData,
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
                            .shutdown()
                            .update(new Update(updater, filename, paths.getExec()))
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
                    description: `Update to ${(candidate as IReleaseData).name}`,
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
