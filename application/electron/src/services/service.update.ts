import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import ServicePaths from '../services/service.paths';
import Logger from '../tools/env.logger';
import { getPlatform, EPlatforms } from '../tools/env.os';
import { IService } from '../interfaces/interface.service';
import ServicePackage from './service.package';
import ServiceElectron, { Subscription, IPCMessages } from './service.electron';
import ServiceProduction from './service.production';
import GitHubClient, { IReleaseAsset, IReleaseData } from '../tools/env.github.client';
import { IMainApp } from '../interfaces/interface.main';

const CHooks = {
    alias: '<alias>',
    version: '<version>',
    platform: '<platform>',
};
const CReleaseNameAliases = [ 'logviewer', 'chipmunk' ];
const CAssetFilePattern = `${CHooks.alias}@${CHooks.version}-${CHooks.platform}-portable.tgz`;
const CSettings: {
    repo: string,
} = {
    repo: 'chipmunk',
};

/**
 * @class ServiceUpdate
 * @description Log information about state of application
 */

class ServiceUpdate implements IService {

    private _logger: Logger = new Logger('ServiceUpdate');
    private _target: string | undefined;
    private _tgzfile: string | undefined;
    private _subscription: { [key: string]: Subscription } = {};
    private _main: IMainApp | undefined;

    /**
     * Initialization function
     * @returns Promise<void>
     */
    public init(main?: IMainApp): Promise<void> {
        return new Promise((resolve, reject) => {
            if (main === undefined) {
                return reject(new Error(`Instance of main process is required.`));
            }
            this._main = main;
            Promise.all([
                ServiceElectron.IPC.subscribe(ServiceElectron.IPCMessages.RenderState, this._onRenderState.bind(this)).then((subscription: Subscription) => {
                    this._subscription.RenderState = subscription;
                }),
                ServiceElectron.IPC.subscribe(ServiceElectron.IPCMessages.UpdateRequest, this._onUpdateRequest.bind(this)).then((subscription: Subscription) => {
                    this._subscription.UpdateRequest = subscription;
                }),
            ]).then(() => {
                resolve();
            }).catch((error: Error) => {
                this._logger.warn(`Fail to make subscriptions to due error: ${error.message}`);
                resolve();
            });
        });
    }

    public destroy(): Promise<void> {
        return new Promise((resolve) => {
            resolve();
        });
    }

    public getName(): string {
        return 'ServiceUpdate';
    }

    private _check() {
        if (!ServiceProduction.isProduction()) {
            // In dev mode do not check for updates
            return;
        }
        GitHubClient.getAllReleases({ repo: CSettings.repo }).then((releases: IReleaseData[]) => {
            const current: string | undefined = ServicePackage.get().version;
            if (typeof current !== 'string' || current.trim() === '') {
                return this._logger.warn(`Fail to detect version of current app.`);
            }
            let latest: string = current;
            let info: IReleaseData | undefined;
            releases.forEach((release: IReleaseData) => {
                if (this._isVersionNewer(latest, release.name)) {
                    latest = release.name;
                    info = release;
                }
            });
            if (info === undefined) {
                // No update found
                this._logger.debug(`Current version "${current}" is newest, no update needed.`);
                return;
            }
            this._logger.debug(`New version is released: ${info.name}`);
            const targets: string[] | Error = this._getAssetFileName(latest);
            if (targets instanceof Error) {
                return this._logger.warn(`Fail to get targets due error: ${targets.message}`);
            }
            let tgzfile: string | undefined;
            info.assets.forEach((asset: IReleaseAsset) => {
                if (targets.indexOf(asset.name) !== -1) {
                    tgzfile = asset.name;
                }
            });
            if (tgzfile === undefined) {
                return this._logger.warn(`Fail to find tgz file with release for current platform.`);
            }
            this._target = latest;
            const file: string = path.resolve(ServicePaths.getDownloads(), tgzfile);
            if (fs.existsSync(file)) {
                // File was already downloaded
                this._tgzfile = file;
                this._notify(latest);
            } else {
                this._logger.debug(`Found new version "${latest}". Starting downloading: ${tgzfile}.`);
                GitHubClient.download({
                    repo: CSettings.repo,
                }, {
                    version: latest,
                    name: tgzfile,
                    dest: ServicePaths.getDownloads(),
                }).then((_tgzfile: string) => {
                    this._tgzfile = _tgzfile;
                    this._notify(latest);
                    this._logger.debug(`File ${tgzfile} is downloaded into: ${_tgzfile}.`);
                }).catch((downloadError: Error) => {
                    this._logger.error(`Fail to download "${tgzfile}" due error: ${downloadError.message}`);
                });
            }
        }).catch((gettingReleasesError: Error) => {
            this._logger.warn(`Fail to get releases list due error: ${gettingReleasesError.message}`);
        });
    }

    private _notify(version: string) {
        ServiceElectron.IPC.send(new ServiceElectron.IPCMessages.Notification({
            caption: `Update`,
            message: `New version of chipmunk "${version}" is available.`,
            type: ServiceElectron.IPCMessages.Notification.Types.info,
            session: '*',
            actions: [
                {
                    type: ServiceElectron.IPCMessages.ENotificationActionType.ipc,
                    value: 'UpdateRequest',
                    caption: 'Update',
                },
            ],
        }));
    }

    private _getAssetFileName(version: string): string[] | Error {
        const platform: EPlatforms = getPlatform();
        if (platform === EPlatforms.undefined) {
            return new Error(`Fail to detect supported platform for (${os.platform()}).`);
        }
        return CReleaseNameAliases.map((alias: string) => {
            const pattern = CAssetFilePattern;
            return pattern.replace(CHooks.alias, alias).replace(CHooks.version, version).replace(CHooks.platform, platform);
        });
    }

    private _versplit(version: string): number[] {
        return version.split('.').map((part: string) => {
            return parseInt(part, 10);
        }).filter((value: number) => {
            return isNaN(value) ? false : isFinite(value);
        });
    }

    private _isVersionNewer(current: string, target: string): boolean {
        const cParts: number[] = this._versplit(current);
        const tParts: number[] = this._versplit(target);
        if (cParts.length !== 3 || tParts.length !== 3) {
            return false;
        }
        const diff: number[] = cParts.map((xxx: number, i: number) => {
            return tParts[i] - xxx;
        });
        if (diff[0] > 0) {
            return true;
        }
        if (diff[0] === 0 && diff[1] > 0) {
            return true;
        }
        if (diff[0] === 0 && diff[1] === 0 && diff[2] > 0) {
            return true;
        }
        return false;
    }

    private _onRenderState(message: IPCMessages.TMessage) {
        if ((message as IPCMessages.RenderState).state !== IPCMessages.ERenderState.ready) {
            return;
        }
        this._check();
    }

    private _getLauncherFile(): Promise<string> {
        return new Promise((resolve, reject) => {
            // process.noAsar = true;
            const updater: string = path.resolve(ServicePaths.getRoot(), `apps/${os.platform() === 'win32' ? 'updater.exe' : 'updater'}`);
            if (!fs.existsSync(updater)) {
                return reject(new Error(`Fail to find an updater in package "${updater}".`));
            }
            const existed: string = path.resolve(ServicePaths.getApps(), (os.platform() === 'win32' ? 'updater.exe' : 'updater'));
            if (fs.existsSync(existed)) {
                try {
                    this._logger.debug(`Found existed updater "${existed}". It will be removed.`);
                    fs.unlinkSync(existed);
                } catch (e) {
                    return reject(e);
                }
            }
            fs.copyFile(updater, existed, (error: NodeJS.ErrnoException | null) => {
                if (error) {
                    return reject(error);
                }
                this._logger.debug(`Updater "${existed}" is delivered.`);
                resolve(existed);
            });
        });
    }

    private _onUpdateRequest(message: IPCMessages.TMessage) {
        if (this._tgzfile === undefined) {
            return;
        }
        this._getLauncherFile().then((updater: string) => {
            this._update(updater);
        }).catch((gettingLauncherErr: Error) => {
            this._logger.error(`Fail to get updater due error: ${gettingLauncherErr.message}`);
        });
    }

    private _update(updater: string) {
        if (this._tgzfile === undefined || this._main === undefined) {
            return;
        }
        const exec: string = ServicePaths.getExec();
        this._logger.debug(`Prepare app to be closed`);
        this._main.destroy().then(() => {
            const exitCode: number = 131;
            this._logger.debug(`Application is ready to be closed`);
            /*
            this._logger.debug(`Starting updater:\n\t- ${updater} ${exec} ${this._tgzfile}`);
            const child: ChildProcess = spawn(updater, [exec, this._tgzfile as string], {
                detached: true,
                stdio: 'ignore',
            });
            child.unref();
            */
            this._logger.debug(`Force closing of app with code ${exitCode}`);
            ServiceElectron.quit(exitCode);
        }).catch((destroyErr: Error) => {
            this._logger.error(`Fail to prepare app to be closed due error: ${destroyErr.message}`);
        });
    }

}

export default (new ServiceUpdate());
