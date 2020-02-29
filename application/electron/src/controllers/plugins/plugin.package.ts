import * as path from 'path';
import * as FS from '../../tools/fs';
import * as Objects from '../../tools/env.objects';

import Logger from '../../tools/env.logger';

export enum EProcessPluginType {
    single = 'single',
    multiple = 'multiple',
}

export interface ILogviewer {
    version: string;
    type: EProcessPluginType;
}

export interface IPackageJson {
    version: string;
    main: string;
    logviewer: ILogviewer;
    [key: string]: any;
 }

const CRequiredFields: { [key: string]: string } = {
    main: 'string',
    version: 'string',
};
/**
 * @class ControllerPluginPackage
 * @description Keeps information from package.json of plugin
 */

export default class ControllerPluginPackage {

    private _logger: Logger = new Logger('ControllerPluginPackage');
    private _package: IPackageJson | undefined;
    private _folder: string;

    /**
     * @param {string} folder destination folder with package.json file
     */
    constructor(folder: string) {
        this._folder = folder;
    }

    /**
     * Read package.json and try to parse as JSON
     * @returns { Promise<IPackageJson> }
     */
    public read(): Promise<void> {
        return new Promise((resolve, reject) => {
            FS.exist(this._folder).then((exist: boolean) => {
                if (!exist) {
                    return reject(new Error(this._logger.warn(`Folder "${this._folder}" doesn't exist`)));
                }
                const packageFile: string = path.resolve(this._folder, 'package.json');
                FS.readTextFile(packageFile).then((content: string) => {
                    const json = Objects.getJSON(content);
                    if (json instanceof Error) {
                        return reject(new Error(this._logger.error(`Cannot parse package file "${packageFile}" due error: ${json.message}`)));
                    }
                    const missed: string[] = [];
                    Object.keys(CRequiredFields).forEach((key: string) => {
                        if (typeof json[key] !== CRequiredFields[key]) {
                            missed.push(key);
                        }
                    });
                    if (missed.length > 0) {
                        return reject(new Error(this._logger.warn(`Next field(s) in "${packageFile}" wasn't found: ${missed.join(', ')}`)));
                    }
                    this._package = this._setPluginsSettings(json);
                    resolve();
                }).catch((error: Error) => {
                    reject(new Error(this._logger.warn(`Fail to read package at "${packageFile}" due error: ${error.message}`)));
                });
            }).catch((existErr: Error) => {
                reject(new Error(this._logger.warn(`Fail to read package due error: ${existErr.message}`)));
            });
        });
    }

    public getPackageJson(): IPackageJson {
        return Object.assign({}, this._package);
    }

    public getPath(): string {
        return this._folder;
    }

    private _setPluginsSettings(packageJson: IPackageJson): IPackageJson {
        if (typeof packageJson.logviewer !== 'object' || packageJson.logviewer === null) {
            packageJson.logviewer = {
                version: '',
                type: EProcessPluginType.multiple,
            };
        }
        packageJson.logviewer.type = packageJson.logviewer.type === undefined ? EProcessPluginType.multiple : packageJson.logviewer.type;
        return packageJson;
    }

}
