// tslint:disable:max-classes-per-file

import * as fs from 'fs';
import * as path from 'path';
import * as util from 'util';

import Logger from '../tools/env.logger';
import guid from '../tools/tools.guid';
import ServicePaths from '../services/service.paths';

import { getRaw, download } from './env.net';

const CSettings: {
    user: string;
    uri: string;
} = {
    user: 'esrlabs',
    uri: 'https://api.github.com/repos/',
};

export interface IGitHubOptions {
    user?: string;
    repo: string;
}

export interface IAssetOptions {
    version?: string;
    name: string;
    dest: string;
}

export interface IReleaseAsset {
    name: string;
    url: string;
    browser_download_url: string;
}

export interface IReleaseData {
    assets: IReleaseAsset[];
    map?: Map<string, GitHubAsset>;
    name: string;
    id: number;
}

export class GitHubAsset {

    private _asset: IReleaseAsset;
    private _logger: Logger;

    constructor(asset: IReleaseAsset) {
        this._asset = asset;
        this._logger = new Logger(`Asset: ${this._asset.name}`);
    }

    public desc(): IReleaseAsset {
        return this._asset;
    }

    public raw(): Promise<string> {
        return new Promise((resolve, reject) => {
            getRaw(this._asset.browser_download_url).then((raw: string) => {
                resolve(raw);
            }).catch((err: Error) => {
                reject(new Error(this._logger.error(`Fail to read asset due error: ${err.message}`)));
            });
        });
    }

    public saveTo(dest: string): Promise<string> {
        return new Promise((resolve, reject) => {
            download(this._asset.browser_download_url, dest).then((raw: string) => {
                resolve(raw);
            }).catch((err: Error) => {
                reject(new Error(this._logger.error(`Fail to download asset due error: ${err.message}`)));
            });
        });
    }
}

export class GitHubClient {

    private _logger: Logger = new Logger(`GitHubClient`);

    public getLatestRelease(opt: IGitHubOptions): Promise<IReleaseData> {
        return new Promise((resolve, reject) => {
            getRaw(`${CSettings.uri}${opt.user !== undefined ? opt.user : CSettings.user}/${opt.repo}/releases/latest`, {
                'Accept': 'application/vnd.github.v3+json',
            }).then((raw: string) => {
                try {
                    const release = JSON.parse(raw);
                    if (release.assets instanceof Array) {
                        release.map = new Map();
                        release.assets.forEach((asset: IReleaseAsset) => {
                            this._logger.debug(`Found asset for release: ${asset.name}`);
                            release.map?.set(asset.name, new GitHubAsset(asset));
                        });
                    }
                    resolve(release);
                } catch (e) {
                    reject(new Error(this._logger.error(`Fail parse releases list due error: ${e.message}`)));
                }
            }).catch((err: Error) => {
                reject(new Error(this._logger.error(`Fail get releases list due error: ${err.message}`)));
            });
        });
    }

    public getReleases(opt: IGitHubOptions, filter?: { tag?: string }): Promise<IReleaseData[]> {
        return new Promise((resolve, reject) => {
            let uri: string = `${CSettings.uri}${opt.user !== undefined ? opt.repo : CSettings.user}/${opt.repo}/releases`;
            if (filter !== undefined) {
                if (filter.tag !== undefined) {
                    uri += `/tags/${filter.tag}`;
                }
            }
            getRaw(uri, {
                'Accept': 'application/vnd.github.v3+json',
            }).then((raw: string) => {
                try {
                    let releases = JSON.parse(raw);
                    if (!(releases instanceof Array) && typeof releases === 'object' && releases !== null) {
                        releases = [releases];
                    }
                    if (!(releases instanceof Array)) {
                        reject(new Error(`Unexpected format of releases list: ${util.inspect(releases)}`));
                    } else {
                        resolve(releases);
                    }
                } catch (e) {
                    reject(new Error(this._logger.error(`Fail parse releases list due error: ${e.message}`)));
                }
            }).catch((err: Error) => {
                reject(new Error(this._logger.error(`Fail get releases list due error: ${err.message}`)));
            });
        });
    }

    public download(opt: IGitHubOptions, asset: IAssetOptions): Promise<string> {
        return new Promise((resolve, reject) => {
            const output = path.resolve(asset.dest, asset.name);
            // Check: does already exist
            if (fs.existsSync(output)) {
                return resolve(output);
            }
            const tmp = path.resolve(ServicePaths.getTmp(), guid());
            this.getReleases(opt, asset.version !== undefined ? { tag: asset.version } : undefined).then((releases: IReleaseData[]) => {
                // Find neccessary asset
                const last = releases[0];
                const target = last.assets.find((_: any) => _.name === asset.name);
                if (!target) {
                    return reject(new Error(`No asset named ${asset.name} found`));
                }
                // Download asset
                download(target.browser_download_url, tmp).then((filename: string) => {
                    fs.copyFile(tmp, output, (copyErr: NodeJS.ErrnoException | null) => {
                        if (copyErr) {
                            reject(new Error(this._logger.warn(`Fail copy file "${tmp}" to "${output}" due error: ${copyErr.message}`)));
                        }
                        fs.unlink(tmp, (rmErr: NodeJS.ErrnoException | null) => {
                            if (rmErr) {
                                this._logger.warn(`Fail remove file "${tmp}" due error: ${rmErr.message}`);
                            }
                            resolve(output);
                        });
                    });
                }).catch((err: Error) => {
                    reject(new Error(`Fail to download asset ${target.browser_download_url} to ${tmp} due error: ${err.message}`));
                });
            }).catch((err: Error) => {
                reject(new Error(`Fail to get releases due error: ${err.message}`));
            });
        });
    }

}

export default (new GitHubClient());
