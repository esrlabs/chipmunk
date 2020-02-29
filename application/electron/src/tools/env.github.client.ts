// tslint:disable:max-classes-per-file

import Logger from '../tools/env.logger';
import * as fs from 'fs';
import * as path from 'path';
import * as util from 'util';

// tslint:disable-next-line:no-var-requires
const GitHub: any = require('github-releases');

const CSettings: {
    user: string,
} = {
    user: 'esrlabs',
};

export interface IGitHubOptions {
    user?: string;
    token?: string;
    repo: string;
}

export interface IAssetOptions {
    version: string;
    name: string;
    dest: string;
}

export interface IReleaseAsset {
    name: string;
    url: string;
}

export interface IReleaseData {
    assets: IReleaseAsset[];
    map?: Map<string, GitHubAsset>;
    name: string;
    id: number;
}

export class GitHubAsset {

    private _asset: IReleaseAsset;
    private _client: () => any;

    constructor(asset: IReleaseAsset, client: () => any) {
        this._asset = asset;
        this._client = client;
    }

    public desc(): IReleaseAsset {
        return this._asset;
    }

    public get(): Promise<Buffer> {
        return new Promise((resolve, reject) => {
            this._client().downloadAsset(this._asset, (downloadAssetError: Error | null | undefined, reader: fs.ReadStream) => {
                if (downloadAssetError) {
                    return reject(downloadAssetError);
                }
                const chunks: Buffer[] = [];
                let error: Error | undefined;
                reader.on('error', (err: Error) => {
                    error = err;
                    reject(error);
                });
                reader.on('data', (chunk: Buffer) => {
                    chunks.push(chunk);
                });
                reader.on('end', () => {
                    if (error) {
                        return;
                    }
                    const content = Buffer.concat(chunks);
                    resolve(content);
                });
            });
        });
    }

    public download(dest: string): Promise<string> {
        return new Promise((resolve, reject) => {
            this._client().downloadAsset(this._asset, (downloadAssetError: Error | null | undefined, reader: fs.ReadStream) => {
                if (downloadAssetError) {
                    return reject(downloadAssetError);
                }
                // Create writer stream
                const writer: fs.WriteStream = fs.createWriteStream(dest);
                // Attach listeners
                reader.on('error', reject);
                writer.on('error', reject);
                writer.on('close', () => {
                    resolve(dest);
                });
                // Pipe
                reader.pipe(writer);
            });
        });
    }
}

export class GitHubClient {

    private _logger: Logger = new Logger(`GitHubClient`);

    public getLatestRelease(opt: IGitHubOptions): Promise<IReleaseData> {
        return new Promise((resolve, reject) => {
            const github = this._getGithubClient(opt);
            if (github instanceof Error) {
                return reject(github);
            }
            github.callRepoApi('releases/latest', (error: Error | null, release: IReleaseData) => {
                if (error) {
                    return reject(error);
                }
                if (typeof release !== 'object' || release === null) {
                    return reject(new Error(`Unexpected format of release: ${util.inspect(release)}`));
                }
                if (release.assets instanceof Array) {
                    release.map = new Map();
                    release.assets.forEach((asset: IReleaseAsset) => {
                        release.map?.set(asset.name, new GitHubAsset(asset, this._getGithubClient.bind(this, opt)));
                    });
                }
                resolve(release);
            });
        });
    }

    public getAllReleases(opt: IGitHubOptions): Promise<IReleaseData[]> {
        return new Promise((resolve, reject) => {
            const github = this._getGithubClient(opt);
            if (github instanceof Error) {
                return reject(github);
            }
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

    public download(opt: IGitHubOptions, asset: IAssetOptions): Promise<string> {
        return new Promise((resolve, reject) => {
            // Create transport
            const github = this._getGithubClient(opt);
            if (github instanceof Error) {
                return reject(github);
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

    private _getGithubClient(opt: IGitHubOptions): any | Error {
        try {
            return new GitHub({
                user: opt.user !== undefined ? opt.user : CSettings.user,
                repo: opt.repo,
                token: opt.token,
            });
        } catch (e) {
            return new Error(this._logger.error(`Fail to create github client due error: ${e.message}`));
        }
    }

}

export default (new GitHubClient());
