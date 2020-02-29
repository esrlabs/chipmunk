// tslint:disable:max-classes-per-file

import * as path from 'path';
import * as FS from '../../tools/fs';
import * as request from 'request';
import * as fs from 'fs';

import Logger from '../../tools/env.logger';
import ServicePaths from '../../services/service.paths';

import GitHubClient, { IReleaseAsset, IReleaseData, GitHubAsset } from '../../tools/env.github.client';

import { getPlatform, EPlatforms } from '../../tools/env.os';

const CSettings: {
    user: string,
    repo: string,
    registerListFile: string,
} = {
    user: 'DmitryAstafyev',
    repo: 'chipmunk.plugins.store',
    registerListFile: 'releases-{platform}.json',
};

export interface IPluginReleaseInfo {
    name: string;
    url: string;
    version: string;
    hash: string;
    default: boolean;
    signed: boolean;
    file: string;
}

/**
 * @class ControllerPluginStore
 * @description Delivery default plugins into logviewer folder
 */

export default class ControllerPluginStore {

    private _logger: Logger = new Logger(`ControllerPluginStore ("${CSettings.user}/${CSettings.repo}")`);
    private _plugins: Map<string, IPluginReleaseInfo> = new Map();

    public read(): Promise<void> {
        return new Promise((resolve, reject) => {
            this._setRegister().then(() => {
                resolve();
            });
        });
    }

    public getInfo(name: string): IPluginReleaseInfo | undefined {
        return this._plugins.get(name);
    }

    public download(name: string): Promise<string> {
        return new Promise((resolve, reject) => {
            // Check plugin info
            const plugin: IPluginReleaseInfo | undefined = this.getInfo(name);
            if (plugin === undefined) {
                return reject(new Error(this._logger.warn(`Plugin "${name}" isn't found.`)));
            }
            // Download plugin
            const target: string = path.resolve(ServicePaths.getPlugins(), plugin.file);
            FS.unlink(target).then(() => {
                const writer = fs.createWriteStream(target);
                request(plugin.url).pipe(writer).on('finish', () => {
                    resolve(target);
                }).on('error', (error) => {
                    reject(error);
                });
            }).catch((unlinkErr: Error) => {
                reject(new Error(this._logger.warn(`Fail to remove file "${target}" due error: ${unlinkErr.message}`)));
            });
        });
    }

    public getDefaults(exclude: string[]): IPluginReleaseInfo[] {
        return Array.from(this._plugins.values()).filter((plugin: IPluginReleaseInfo) => {
            return exclude.indexOf(plugin.name) === -1 && plugin.default;
        });
    }

    private _setRegister(): Promise<void> {
        return new Promise((resolve, reject) => {
            GitHubClient.getLatestRelease({ user: CSettings.user, repo: CSettings.repo }).then((release: IReleaseData) => {
                if (release.map === undefined) {
                    return reject(new Error(this._logger.warn(`Plugins-store repo doesn't have any assets in latest release.`)));
                }
                const filename: string = this._getRegisterFileName();
                const asset: GitHubAsset | undefined = release.map.get(filename);
                if (asset === undefined) {
                    return reject(new Error(this._logger.warn(`Fail to find "${filename}" in assets of latest release.`)));
                }
                asset.get().then((buf: Buffer) => {
                    try {
                        const list: IPluginReleaseInfo[] = JSON.parse(buf.toString());
                        if (!(list instanceof Array)) {
                            return reject(new Error(this._logger.warn(`Incorrect format of asseets`)));
                        }
                        list.forEach((plugin: IPluginReleaseInfo) => {
                            this._plugins.set(plugin.name, plugin);
                        });
                    } catch (e) {
                        return reject(new Error(this._logger.warn(`Fail parse asset to JSON due error: ${e.message}`)));
                    }
                    resolve();
                }).catch((assetErr: Error) => {
                    this._logger.warn(`Fail get asset due error: ${assetErr.message}`);
                    reject(assetErr);
                });
            }).catch((error: Error) => {
                this._logger.warn(`Fail get latest release due error: ${error.message}`);
                reject(error);
            });
        });
    }

    private _getRegisterFileName(): string {
        return CSettings.registerListFile.replace('{platform}', getPlatform(true));
    }

}
