import * as fs from 'fs';
import * as path from 'path';
import * as util from 'util';
import * as os from 'os';
import ServicePaths from '../services/service.paths';
import Logger from '../tools/env.logger';
import { IService } from '../interfaces/interface.service';
import ServicePackage from './service.package';
import ServiceElectron, { Subscription, IPCMessages } from './service.electron';
import ServiceProduction from './service.production';
import { IMainApp } from '../interfaces/interface.main';

// tslint:disable-next-line:no-var-requires
const GitHub: any = require('github-releases');

const CHooks = {
    alias: '<alias>',
    version: '<version>',
    platform: '<platform>',
};
const CReleaseNameAliases = [ 'logviewer', 'chipmunk' ];
const CAssetFilePattern = `${CHooks.alias}@${CHooks.version}-${CHooks.platform}-portable.tgz`;
const CSettings: {
    user: string,
    repo: string,
} = {
    user: 'esrlabs',
    repo: 'chipmunk',
};
export enum EPlatforms {
    aix = 'aix',
    darwin = 'darwin',
    freebsd = 'freebsd',
    linux = 'linux',
    openbsd = 'openbsd',
    sunos = 'sunos',
    win32 = 'win32',
    win64 = 'win64',
    android = 'android',
    undefined = 'undefined',
}

export interface IGitHubOptions {
    user: string;
    repo: string;
}

export interface IAssetOptions {
    version: string;
    name: string;
    dest: string;
}

export interface IReleaseAsset {
    name: string;
}
export interface IReleaseData {
    assets: IReleaseAsset[];
    name: string;
    id: number;
}
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
        this._getAllReleases().then((releases: IReleaseData[]) => {
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
                this._logger.env(`Current version "${current}" is newest, no update needed.`);
                return;
            }
            this._logger.env(`New version is released: ${info.name}`);
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
                this._logger.env(`Found new version "${latest}". Starting downloading: ${tgzfile}.`);
                this._getAsset({
                    user: CSettings.user,
                    repo: CSettings.repo,
                }, {
                    version: latest,
                    name: tgzfile,
                    dest: ServicePaths.getDownloads(),
                }).then((_tgzfile: string) => {
                    this._tgzfile = _tgzfile;
                    this._notify(latest);
                    this._logger.env(`File ${tgzfile} is downloaded into: ${_tgzfile}.`);
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

    private _getAsset(git: IGitHubOptions, asset: IAssetOptions): Promise<string> {
        return new Promise((resolve, reject) => {
            // Create transport
            let github: any;
            try {
                github = new GitHub({
                    user: git.user,
                    repo: git.repo,
                });
            } catch (e) {
                return reject(e);
            }
            const output = path.join(asset.dest, asset.name);
            // Check: does already exist
            if (fs.existsSync(output)) {
                return resolve(output);
            }
            // Downloading
            github.getReleases({ tag_name: asset.version }, (getReleaseError: Error | null | undefined, releases: any[]) => {
                if (getReleaseError) {
                    return reject(getReleaseError);
                }
                // Find neccessary asset
                const last = releases[0];
                const target = last.assets.find((_: any) => _.name === asset.name);
                if (!target) {
                    return reject(new Error(`No asset named ${asset.name} found`));
                }
                // Download asset
                github.downloadAsset(target, (downloadAssetError: Error | null | undefined, reader: fs.ReadStream) => {
                    if (downloadAssetError) {
                        return reject(downloadAssetError);
                    }
                    // Create writer stream
                    const writer: fs.WriteStream = fs.createWriteStream(output);
                    // Attach listeners
                    reader.on('error', reject);
                    writer.on('error', reject);
                    writer.on('close', () => {
                        resolve(output);
                    });
                    // Pipe
                    reader.pipe(writer);
                });
            });
        });
    }

    private _getAllReleases(): Promise<IReleaseData[]> {
        return new Promise((resolve, reject) => {
            const github = new GitHub({
                user: CSettings.user,
                repo: CSettings.repo,
                token: '',
            });
            github.getReleases({}, (error: Error | null, releases: IReleaseData[]) => {
                if (error) {
                    return reject(error);
                }
                if (!(releases instanceof Array)) {
                    return reject(new Error(`Unexpected format of releases list: ${util.inspect(releases)}`));
                }
                resolve(releases);
            });
        });
    }

    private _getAssetFileName(version: string): string[] | Error {
        const platform: EPlatforms = this._getPlatform();
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

    private _getPlatform(): EPlatforms {
        switch (os.platform()) {
            case EPlatforms.aix:
            case EPlatforms.freebsd:
            case EPlatforms.linux:
            case EPlatforms.openbsd:
                return EPlatforms.linux;
            case EPlatforms.darwin:
                return EPlatforms.darwin;
            case EPlatforms.win32:
                if (os.arch() === 'x32') {
                    return EPlatforms.win32;
                } else if (os.arch() === 'x64') {
                    return EPlatforms.win64;
                }
                break;
        }
        return EPlatforms.undefined;
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
                    this._logger.env(`Found existed updater "${existed}". It will be removed.`);
                    fs.unlinkSync(existed);
                } catch (e) {
                    return reject(e);
                }
            }
            fs.copyFile(updater, existed, (error: NodeJS.ErrnoException | null) => {
                if (error) {
                    return reject(error);
                }
                this._logger.env(`Updater "${existed}" is delivered.`);
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
        this._logger.env(`Prepare app to be closed`);
        this._main.destroy().then(() => {
            const exitCode: number = 131;
            this._logger.env(`Application is ready to be closed`);
            /*
            this._logger.env(`Starting updater:\n\t- ${updater} ${exec} ${this._tgzfile}`);
            const child: ChildProcess = spawn(updater, [exec, this._tgzfile as string], {
                detached: true,
                stdio: 'ignore',
            });
            child.unref();
            */
            this._logger.env(`Force closing of app with code ${exitCode}`);
            ServiceElectron.quit(exitCode);
        }).catch((destroyErr: Error) => {
            this._logger.error(`Fail to prepare app to be closed due error: ${destroyErr.message}`);
        });
    }

}

export default (new ServiceUpdate());
