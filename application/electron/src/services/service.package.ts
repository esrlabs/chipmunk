import * as Path from 'path';
import * as Objects from '../../platform/cross/src/env.objects';
import * as FS from '../../platform/node/src/fs';

import Logger from '../../platform/node/src/env.logger';
import ServicePaths from './service.paths';

import { IService } from '../interfaces/interface.service';

/**
 * @class ServicePackage
 * @description Looking for package.json file and delivery content of it
 */

export class ServicePackage implements IService {

    private _logger: Logger = new Logger('ServicePackage');
    private _file: string;
    private _package: any = null;

    constructor() {
        this._file = Path.resolve(ServicePaths.getRoot(), 'package.json');
    }

    /**
     * Initialization function
     * @returns Promise<void>
     */
    public init(): Promise<void> {
        return new Promise((resolve, reject) => {
            this._read().then((json: any) => {
                this._package = json;
                resolve();
            }).catch((error: Error) => {
                this._logger.error(`Fail to read package.json due error: ${error.message}`);
                reject(error);
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

    public get(): any {
        return Objects.copy(this._package);
    }

    private _read(): Promise<any> {
        return new Promise((resolve, reject) => {
            if (!FS.isExist(this._file)) {
                return reject(new Error(this._logger.error(`Package file "${this._file}" doesn't exist`)));
            }
            FS.readTextFile(this._file).then((content: string) => {
                const json = Objects.getJSON(content);
                if (json instanceof Error) {
                    return reject(new Error(this._logger.error(`Cannot parse package file "${this._file}" due error: ${json.message}`)));
                }
                this._logger.env(`package.json file successfully read from ${this._file}.`);
                resolve(json);
            }).catch((error: Error) => {
                this._logger.error(`Fail to read package at "${this._file}" due error: ${error.message}`);
            });
        });
    }

}

export default (new ServicePackage());
