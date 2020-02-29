import * as path from 'path';
import * as FS from '../../tools/fs';

import ControllerPluginPackage, { IPackageJson } from './plugin.package';

import Logger from '../../tools/env.logger';

export default class ControllerPluginRender {

    private _packagejson: ControllerPluginPackage;
    private _name: string;
    private _logger: Logger;
    private _entrypoint: string | undefined;

    constructor(name: string, packagejson: ControllerPluginPackage) {
        this._name = name;
        this._packagejson = packagejson;
        this._logger = new Logger(`Plugin render [${this._name}]`);
    }

    public init(): Promise<void> {
        return new Promise((resolve, reject) => {
            const main: string = this._packagejson.getPackageJson().main;
            // Check main file of plugin
            const entrypoint: string = path.normalize(path.resolve(this._packagejson.getPath(), main));
            FS.exist(entrypoint).then((exist: boolean) => {
                if (!exist) {
                    return reject(new Error(this._logger.warn(`Target file "${entrypoint}" doesn't exist.`)));
                }
                this._entrypoint = entrypoint;
                resolve();
            });
        });
    }

    public getEntrypoint(): string | undefined{
        return this._entrypoint;
    }

}
