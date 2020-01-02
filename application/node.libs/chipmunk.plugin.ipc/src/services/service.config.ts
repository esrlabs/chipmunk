import * as fs from 'fs';
import * as path from 'path';

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
        console.log(`!!!>>> ${this._path}`);
        console.log(`!!!>>> ${this._alias}`);
    }

    /**
     * This method store default settins.
     * Default settings will be used if any settings were not saved before
     * @param {T} defaults - defaults settings
     */
    public setDefault<T>(defaults: T) {
        if (typeof defaults !== 'object' || defaults === null) {
            return;
        }
        this._defaults = Object.assign({}, defaults);
    }

    /**
     * Returns settings from file.
     * @param {T} defaults - defaults settings (optional)
     * @returns {Promise<T>} - T an interface of settings
     */
    public get<T>(defaults?: T): Promise<T> {
        return new Promise<T>((resolve, reject) => {
            if (this._path === undefined) {
                return reject(new Error(`Fail to get settings because path of settings isn't defined by core`));
            }
            if (this._alias === undefined) {
                return reject(new Error(`Fail to get settings because alias of settings isn't defined by core`));
            }
            this.setDefault(defaults);
            if (typeof this._defaults !== 'object' || this._defaults === null) {
                return reject(new Error(`Fail to get settings because defaults settings aren't setup. Please, setup defaults first using method "setDefault"`));
            }
            const file: string = this._getFileName();
            fs.open(file, 'r', (err: NodeJS.ErrnoException | null, fd: number) => {
                if (err) {
                    if (err.code === 'ENOENT') {
                        return resolve(Object.assign({}, this._defaults) as T);
                    } else {
                        return reject(`Fail get settings from "${file}" due error: [${err.code}] ${err.message}`);
                    }
                }
                fs.readFile(fd, 'utf8', (error: NodeJS.ErrnoException | null, data: string | Buffer) => {
                    if (error) {
                        return reject(`Fail read settings file "${file}" due error: [${error.code}] ${error.message}`);
                    }
                    if (data instanceof Buffer) {
                        data = data.toString();
                    }
                    let settings: any;
                    try {
                        settings = JSON.parse(data);
                    } catch (e) {
                        return reject(`Fail get settings from "${file}" due error: ${e.message}. Settings: "${data}"`);
                    }
                    if (typeof settings !== 'object' || settings === null) {
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
     */
    public set(changes: {[key: string]: any}): Promise<void> {
        return new Promise((resolve, reject) => {
            if (this._path === undefined) {
                return reject(new Error(`Fail to set settings because path of settings isn't defined by core`));
            }
            if (this._alias === undefined) {
                return reject(new Error(`Fail to set settings because alias of settings isn't defined by core`));
            }
            this.get<{[key: string]: any}>().then((settings: {[key: string]: any}) => {
                Object.keys(changes).forEach((key: string) => {
                    settings[key] = changes[key];
                });
                const file: string = this._getFileName();
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

    private _getFileName(): string {
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
