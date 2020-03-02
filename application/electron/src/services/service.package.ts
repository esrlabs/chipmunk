import * as Path from 'path';
import * as Objects from '../tools/env.objects';
import * as FS from '../tools/fs';

import Logger from '../tools/env.logger';
import ServicePaths from './service.paths';

import { IService } from '../interfaces/interface.service';

export interface IVersions {
    "electron": string;
    "electron-rebuild": string;
    "chipmunk.client.toolkit": string;
    "chipmunk.plugin.ipc": string;
    "chipmunk-client-material": string;
    "angular-core": string;
    "angular-material": string;
}

export interface IPackageFile {
    version: string;
    chipmunk: {
        versions: IVersions;
    };
}

/**
 * @class ServicePackage
 * @description Looking for package.json file and delivery content of it
 */

export class ServicePackage implements IService {

    private _logger: Logger = new Logger('ServicePackage');
    private _file: string = '';
    private _package: IPackageFile | undefined;

    /**
     * Initialization function
     * @returns Promise<void>
     */
    public init(): Promise<void> {
        return new Promise((resolve, reject) => {
            this._file = Path.resolve(ServicePaths.getRoot(), 'package.json');
            this._read().then((json: IPackageFile) => {
                const error: Error | undefined = this._validate(json);
                if (error instanceof Error) {
                    return reject(new Error(this._logger.error(`package.json isn't valid: ${error.message}`)));
                }
                this._package = json;
                this._logger.debug(`\n${"-".repeat(30)}\nHash of current version: ${this.getHash()}\n${"-".repeat(30)}`);
                resolve();
            }).catch((error: Error) => {
                reject(new Error(this._logger.error(`Fail to read package.json due error: ${error.message}`)));
            });
        });
    }

    public destroy(): Promise<void> {
        return new Promise((resolve) => {
            resolve();
        });
    }

    public getName(): string {
        return 'ServicePackage';
    }

    public get(): IPackageFile {
        return Objects.copy(this._package);
    }

    public getHash(): string {
        const vers: IVersions = (this._package as IPackageFile).chipmunk.versions;
        const p: { [key: number]: string[] } = {};
        p[1] = vers.electron.split('.');
        p[2] = vers["electron-rebuild"].split('.');
        p[3] = vers["chipmunk.client.toolkit"].split('.');
        p[4] = vers["chipmunk.plugin.ipc"].split('.');
        p[5] = vers["chipmunk-client-material"].split('.');
        p[6] = vers["angular-core"].split('.');
        p[7] = vers["angular-material"].split('.');
        let hash: string = '';
        for (let a = 0; a <= 2; a += 1) {
            let part: string = hash === '' ? '' : '.';
            for (let b = 1; b <= 7; b += 1) {
                part += p[b][a];
            }
            hash += part;
        }
        return hash;
    }

    private _read(): Promise<IPackageFile> {
        return new Promise((resolve, reject) => {
            FS.exist(this._file).then((exist: boolean) => {
                if (!exist) {
                    return reject(new Error(this._logger.error(`Package file "${this._file}" doesn't exist`)));
                }
                FS.readTextFile(this._file).then((content: string) => {
                    const json = Objects.getJSON(content);
                    if (json instanceof Error) {
                        return reject(new Error(this._logger.error(`Cannot parse package file "${this._file}" due error: ${json.message}`)));
                    }
                    this._logger.debug(`package.json file successfully read from ${this._file}.`);
                    resolve(json);
                }).catch((error: Error) => {
                    this._logger.error(`Fail to read package at "${this._file}" due error: ${error.message}`);
                });
            });
        });
    }

    private _validate(json: IPackageFile): Error | undefined {
        if (typeof json !== 'object' || json === null) {
            return new Error(`package.json isn't an object`);
        }
        if (typeof json.version !== 'string') {
            return new Error(`Fail to find field "version"`);
        }
        if (typeof json.chipmunk !== 'object' || json.chipmunk === null) {
            return new Error(`Fail to find field "chipmunk"`);
        }
        if (typeof json.chipmunk.versions !== 'object' || json.chipmunk.versions === null) {
            return new Error(`Field "chipmunk.versions" isn't an object`);
        }
        let error: Error | undefined;
        ["electron",
        "electron-rebuild",
        "chipmunk.client.toolkit",
        "chipmunk.plugin.ipc",
        "chipmunk-client-material",
        "angular-core",
        "angular-material"].forEach((key: string) => {
            if (typeof (json.chipmunk.versions as any)[key] !== 'string') {
                error = new Error(`Fail to find version of "${key}" in "chipmunk.versions".`);
            }
        });
        return error;
    }

}

export default (new ServicePackage());
