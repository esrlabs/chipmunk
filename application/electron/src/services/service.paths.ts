import * as OS from 'os';
import * as Path from 'path';
import * as FS from '../tools/fs';
import { app } from 'electron';

import Logger from '../tools/env.logger';
import ServiceProduction from './service.production';

import { IService } from '../../src/interfaces/interface.service';

const HOME_FOLDER = '.chipmunk';
const PLUGINS_FOLDER = 'plugins';
const SOCKETS_FOLDER = 'sockets';
const STREAMS_FOLDER = 'streams';
const DOWNLOADS_FOLDER = 'downloads';
const APPS_FOLDER = 'apps';
const APPLICATION_FILE = 'chipmunk';

export function getHomeFolder(): string {
    return Path.resolve(OS.homedir(), HOME_FOLDER);
}

/**
 * @class ServicePaths
 * @description Gives paths to electron instance
 */

class ServicePaths implements IService {

    private _logger: Logger = new Logger('ServicePaths');
    private _home: string = '';
    private _plugins: string = '';
    private _app: string = '';
    private _root: string = '';
    private _exec: string = '';
    private _appModules: string = '';
    private _resources: string = '';
    private _sockets: string = '';
    private _streams: string = '';
    private _downloads: string = '';
    private _apps: string = '';
    private _rg: string = '';
    private _defaultPlugins: string = '';

    /**
     * Initialization function
     * @returns Promise<void>
     */
    public init(): Promise<void> {
        return new Promise((resolve, reject) => {
            this._home = getHomeFolder();
            this._sockets = Path.resolve(this._home, SOCKETS_FOLDER);
            this._streams = Path.resolve(this._home, STREAMS_FOLDER);
            this._downloads = Path.resolve(this._home, DOWNLOADS_FOLDER);
            this._apps = Path.resolve(this._home, APPS_FOLDER);
            const resources: Error | string = this._getResourcePath();
            if (resources instanceof Error) {
                return reject(resources);
            }
            this._resources = resources;
            const root: string | Error = this._getRootPath();
            if (root instanceof Error) {
                return reject(root);
            }
            if (ServiceProduction.isProduction()) {
                this._plugins = Path.resolve(this._home, PLUGINS_FOLDER);
            } else {
                this._plugins = Path.resolve(root, '../../../sandbox');
            }
            this._app = root;
            this._root = root;
            const exec: string | Error = this._getExecPath();
            if (exec instanceof Error) {
                return reject(exec);
            }
            this._exec = exec;
            this._defaultPlugins = Path.resolve(this._root, 'plugins');
            this._appModules = Path.resolve(this._root, '../../node_modules');
            this._rg = Path.resolve(this._root, `apps/${OS.platform() === 'win32' ? 'rg.exe' : 'rg'}`);
            this._createHomeFolder().then(() => {
                Promise.all([this._home, this._plugins, this._sockets, this._streams, this._downloads, this._apps].map((folder: string) => {
                    return this._mkdir(folder);
                })).then(() => {
                    this._logger.env(`Paths:\n\thome: ${this._home}\n\troot: ${this._root}\n\tapp: ${this._app}\n\texec ${this._exec}\n\tresources ${this._resources}\n\tplugins ${this._plugins}\n\tdefault plugins ${this._defaultPlugins}\n\tsockets ${this._sockets}\n\tstreams ${this._streams}\n\tmodules ${this._appModules}`);
                    resolve();
                }).catch((error: Error) => {
                    this._logger.error(`Fail to initialize paths due error: ${error.message}`);
                    reject(error);
                });
            }).catch(reject);
        });
    }

    public destroy(): Promise<void> {
        return new Promise((resolve) => {
            resolve();
        });
    }

    public getName(): string {
        return 'ServicePaths';
    }

    /**
     * Returns path to logviewer folder (created in home-folder of current user)
     * @returns string
     */
    public getHome(): string {
        return this._home;
    }

    /**
     * Returns path to root folder
     * @returns string
     */
    public getRoot(): string {
        return this._root;
    }

    /**
     * Returns path to default plugins folder
     * @returns string
     */
    public getDefaultPlugins(): string {
        return this._defaultPlugins;
    }

    /**
     * Returns path to node_modules folder of electron app
     * @returns string
     */
    public getAppModules(): string {
        return this._appModules;
    }

    /**
     * Returns path to plugins folder
     * @returns string
     */
    public getPlugins(): string {
        return this._plugins;
    }

    /**
     * Returns path to sockets folder
     * @returns string
     */
    public getSockets(): string {
        return this._sockets;
    }

    /**
     * Returns path to streams folder
     * @returns string
     */
    public getStreams(): string {
        return this._streams;
    }

    /**
     * Returns path to downloads folder
     * @returns string
     */
    public getDownloads(): string {
        return this._downloads;
    }

    /**
     * Returns path to apps folder
     * @returns string
     */
    public getApps(): string {
        return this._apps;
    }

    /**
     * Returns path to executable file
     * @returns string
     */
    public getExec(): string {
        return this._exec;
    }

    /**
     * Returns path to ripgrep module
     * @returns string
     */
    public getRG(): string {
        return this._rg;
    }

    /**
     * Returns path from home perspective
     * @param {string} folder path to folder
     * @returns string
     */
    public resoveHomeFolder(folder: string): string {
        return Path.normalize(Path.resolve(this._home, folder));
    }

    /**
     * Returns path from root perspective
     * @param {string} folder path to folder
     * @returns string
     */
    public resoveRootFolder(folder: string): string {
        return Path.normalize(Path.resolve(this._root, folder));
    }

    /**
     * Check path
     * @param {string} path path to file / folder
     * @returns boolean
     */
    public isExist(path: string): boolean {
        return FS.isExist(path);
    }

    /**
     * Creates logviewer folder (if it's needed)
     * @returns Promise<void>
     */
    private _createHomeFolder(): Promise<void> {
        return this._mkdir(this._home);
    }

    private _mkdir(dir: string): Promise<void> {
        return new Promise((resolve, reject) => {
            if (FS.isExist(dir)) {
                return resolve();
            }
            FS.mkdir(dir).then(() => {
                resolve();
            }).catch((error: Error) => {
                this._logger.error(`Fail to create local logviewer folder "${dir}" due error: ${error.message}`);
                reject(error);
            });
        });
    }

    /**
     * Detects root folder of application
     * @returns Promise<void>
     */
    private _getRootPath(): string | Error {
        if (typeof require.main !== 'undefined' && typeof require.main.filename === 'string' && require.main.filename.trim() !== '') {
            return Path.resolve(Path.dirname(require.main.filename), '../..');
        }
        if (typeof require.resolve('../main') === 'string' && require.resolve('../main').trim() === '') {
            return Path.dirname(require.resolve('../main'));
        }
        if (process.argv instanceof Array && process.argv.length > 0) {
            let sourceFile: string = '';
            process.argv.forEach((arg: string) => {
                if (sourceFile !== '') {
                    return;
                }
                if (arg.search(/\.js$|\.ts$/gi) !== -1) {
                    sourceFile = arg;
                }
            });
            return Path.dirname(Path.resolve(process.cwd(), sourceFile));
        }
        return new Error(`Fail to detect application root folder`);
    }

    private _getExecPath(): string | Error {
        if (!ServiceProduction.isProduction()) {
            return this._root;
        }
        const exec: string = app.getPath('exe');
        switch (OS.platform()) {
            case 'darwin':
                if (exec.search(`.app/Contents/MacOS/app`) === -1) {
                    return new Error(`Cannot find target in ".app" package in path: ${exec}. Probably you forget to switch application into developer mode. Use env variable "CHIPMUNK_DEVELOPING_MODE=ON" to activate it.`);
                }
                return exec.replace(`/Contents/MacOS/app`, '');
                /*
                if (this._root.search(new RegExp(`[^\\\/]*${APPLICATION_FILE}[^\\\/]*\\.app`)) === -1) {
                    return new Error(`Cannot find target file name "${APPLICATION_FILE}.app" in path: ${this._root}. Probably you forget to switch application into developer mode. Use env variable "CHIPMUNK_DEVELOPING_MODE=ON" to activate it.`);
                }
                return `${this._root.replace(new RegExp(`(\\b${APPLICATION_FILE}\\.app\\b)(?!.*\\b\\1\\b)(.*)`, 'gi'), '')}${APPLICATION_FILE}.app`;
                */
            case 'win32':
                return exec;
            default:
                return exec;
        }
    }

    private _getResourcePath(): string | Error {
        if (typeof process.resourcesPath === 'string' && process.resourcesPath !== '') {
            return process.resourcesPath as string;
        }
        if (process.mainModule === undefined) {
            return new Error(`Cannot detect resource path because process.mainModule === undefined`);
        }
        return Path.resolve(process.mainModule.filename, '../../../../../');
    }

}

export default (new ServicePaths());
