import * as OS from 'os';
import * as Path from 'path';
import * as FS from '../tools/fs';

import Logger from '../tools/env.logger';

import { IService } from '../../src/interfaces/interface.service';

const HOME_FOLDER = '.logviewer';
const PLUGINS_FOLDER = 'plugins';
const SOCKETS_FOLDER = 'sockets';
const STREAMS_FOLDER = 'streams';

/**
 * @class ServicePaths
 * @description Gives paths to electron instance
 */

class ServicePaths implements IService {

    private _logger: Logger = new Logger('ServicePaths');
    private _home: string;
    private _plugins: string;
    private _app: string;
    private _root: string;
    private _appModules: string;
    private _resources: string;
    private _sockets: string;
    private _streams: string;
    private _defaultPlugins: string;

    constructor() {
        this._home = Path.resolve(OS.homedir(), HOME_FOLDER);
        this._sockets = Path.resolve(this._home, SOCKETS_FOLDER);
        this._streams = Path.resolve(this._home, STREAMS_FOLDER);
        // this._plugins = Path.resolve(this._home, PLUGINS_FOLDER);
        this._plugins = '/Users/dmitry.astafyev/WebstormProjects/logviewer/electron.github/application/sandbox';
        const resources: Error | string = this._getResourcePath();
        if (resources instanceof Error) {
            throw resources;
        }
        this._resources = resources;
        const root: string | Error = this._getRootPath();
        if (root instanceof Error) {
            throw root;
        }
        this._app = root;
        this._root = Path.resolve(root, '..');
        this._defaultPlugins = Path.resolve(this._root, 'plugins');
        this._appModules = Path.resolve(this._root, '../../node_modules');
    }

    /**
     * Initialization function
     * @returns Promise<void>
     */
    public init(): Promise<void> {
        return new Promise((resolve, reject) => {
            this._createHomeFolder().then(() => {
                Promise.all([this._home, this._plugins, this._sockets, this._streams].map((folder: string) => {
                    return this._mkdir(folder);
                })).then(() => {
                    this._logger.env(`Paths:\n\thome: ${this._home}\n\troot: ${this._root}\n\tapp: ${this._app}\n\tresources ${this._resources}\n\tplugins ${this._plugins}\n\tdefault plugins ${this._defaultPlugins}\n\tsockets ${this._sockets}\n\tstreams ${this._streams}\n\tmodules ${this._appModules}`);
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
                reject();
            });
        });
    }

    /**
     * Detects root folder of application
     * @returns Promise<void>
     */
    private _getRootPath(): string | Error {
        if (typeof require.main !== 'undefined' && typeof require.main.filename === 'string' && require.main.filename.trim() !== '') {
            return Path.dirname(require.main.filename);
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
