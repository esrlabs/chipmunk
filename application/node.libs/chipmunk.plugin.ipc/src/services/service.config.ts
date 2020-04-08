import * as fs from 'fs';
import * as path from 'path';
import { copy, isObject } from '../tools/tools.object';

const CSettingsArg = '--chipmunk-settingspath';
const CPluginAliasArg = '--chipmunk-plugin-alias';

/**
 * @class ServiceConfig
 * @description Provides access to plugin configuration.
 */
export class ServiceConfig {

    private _path: string | undefined;
    private _alias: string | undefined;
    private _defaults: any;

    constructor() {
        this._setProp(CSettingsArg, '_path');
        this._setProp(CPluginAliasArg, '_alias');
    }

    /**
     * As default, service trys to find path to settings folder in process.args.
     * This method can be used for manual settings path and alias
     * @param {string} _path - path to folder with settings
     * @param {string} _alias - unique alias of plugin
     */
    public setup(_path: string, _alias: string) {
        this._path = _path;
        this._alias = _alias;
    }

    /**
     * This method store default settins.
     * Default settings will be used if any settings were not saved before
     * @param {T} defaults - defaults settings
     */
    public setDefault<T>(defaults: T) {
        if (!isObject(defaults)) {
            return;
        }
        this._defaults = copy(defaults);
    }

    /**
     * Returns settings from file.
     * @param {T} defaults - defaults settings (optional)
     * @returns {Promise<T>} - T an interface of settings
     */
    public read<T>(defaults?: T): Promise<T> {
        return new Promise<T>((resolve, reject) => {
            if (this._path === undefined) {
                return reject(new Error(`Fail to get settings because path of settings isn't defined by core`));
            }
            if (this._alias === undefined) {
                return reject(new Error(`Fail to get settings because alias of settings isn't defined by core`));
            }
            this.setDefault(defaults);
            if (!isObject(this._defaults)) {
                return reject(new Error(`Fail to get settings because defaults settings aren't setup. Please, setup defaults first using method "setDefault"`));
            }
            const file: string = this.getFileName();
            fs.open(file, 'r', (err: NodeJS.ErrnoException | null, fd: number) => {
                if (err) {
                    if (err.code === 'ENOENT') {
                        return resolve(copy(this._defaults) as T);
                    } else {
                        return reject(new Error(`Fail get settings from "${file}" due error: [${err.code}] ${err.message}`));
                    }
                }
                fs.readFile(fd, 'utf8', (error: NodeJS.ErrnoException | null, data: string | Buffer) => {
                    if (error) {
                        return reject(new Error(`Fail read settings file "${file}" due error: [${error.code}] ${error.message}`));
                    }
                    if (data instanceof Buffer) {
                        data = data.toString();
                    }
                    let settings: any;
                    try {
                        settings = JSON.parse(data);
                    } catch (e) {
                        return reject(new Error(`Fail get settings from "${file}" due error: ${e.message}. Settings: "${data}"`));
                    }
                    if (!isObject(settings)) {
                        settings = {};
                    }
                    Object.keys(this._defaults).forEach((key: string) => {
                        if (settings[key] === undefined) {
                            settings[key] = this._defaults[key];
                        }
                    });
                    resolve(settings as T);
                });
            });
        });
    }

    /**
     * Saves settings into file
     * @param { {[key: string]: any} } changes - changes of settings.
     * @returns {Promise<void>}
     */
    public write(changes?: {[key: string]: any}): Promise<void> {
        return new Promise((resolve, reject) => {
            if (this._path === undefined) {
                return reject(new Error(`Fail to set settings because path of settings isn't defined by core`));
            }
            if (this._alias === undefined) {
                return reject(new Error(`Fail to set settings because alias of settings isn't defined by core`));
            }
            this.read<{[key: string]: any}>().then((settings: {[key: string]: any}) => {
                if (isObject(changes)) {
                    Object.keys(changes as any).forEach((key: string) => {
                        settings[key] = (changes as any)[key];
                    });
                }
                const file: string = this.getFileName();
                fs.writeFile(file, JSON.stringify(settings), 'utf8', (error: NodeJS.ErrnoException | null) => {
                    if (error) {
                        return reject(new Error(`Fail to write settings file "${file}" due error: [${error.code}] ${error.message}`));
                    }
                    resolve();
                });
            }).catch((readErr: Error) => {
                reject(new Error(`Fail to update settings due error: ${readErr.message}`));
            });
        });
    }

    /**
     * Removes plugin's setting file
     * @returns {Promise<void>}
     */
    public drop(): Promise<void> {
        return new Promise((resolve, reject) => {
            if (this._path === undefined) {
                return reject(new Error(`Fail to drop settings because path of settings isn't defined by core`));
            }
            if (this._alias === undefined) {
                return reject(new Error(`Fail to drop settings because alias of settings isn't defined by core`));
            }
            const file: string = this.getFileName();
            fs.open(file, 'r', (err: NodeJS.ErrnoException | null) => {
                if (err) {
                    if (err.code === 'ENOENT') {
                        // File doesn't exist
                        return resolve();
                    } else {
                        return reject(new Error(`Fail drop settings from "${file}" due error: [${err.code}] ${err.message}`));
                    }
                }
                fs.unlink(file, (unlinkErr: NodeJS.ErrnoException | null) => {
                    if (unlinkErr) {
                        return reject(new Error(`Fail to remove settings file "${file}" due error: [${unlinkErr.code}] ${unlinkErr.message}`));
                    }
                    resolve();
                });
            });
        });
    }

    /**
     * Returns name of setting file (with path)
     * @returns {string}
     */
    public getFileName(): string {
        if (this._path === undefined || this._alias === undefined) {
            return '';
        }
        return path.resolve(this._path, `${this._alias}.cfg`);
    }

    private _setProp(key: string, prop: string) {
        process.argv.forEach((arg: string) => {
            if (arg.indexOf(key) === 0) {
                const parts: string[] = arg.split('=');
                if (parts.length !== 2) {
                    return;
                }
                (this as any)[prop] = parts[1];
            }
        });
    }

}

export default new ServiceConfig();
