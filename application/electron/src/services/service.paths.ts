import * as OS from 'os';
import * as Path from 'path';
import * as FS from '../tools/fs';
import { app } from 'electron';

import Logger from '../tools/env.logger';
import ServiceProduction from './service.production';
import ServiceEnv from './service.env';

import { IService } from '../../src/interfaces/interface.service';

const HOME_FOLDER = '.chipmunk';
const PLUGINS_FOLDER = 'plugins';
const PLUGINS_CONFIG_FOLDER = 'plugins.cfg';
const SOCKETS_FOLDER = 'sockets';
const STREAMS_FOLDER = 'streams';
const DOWNLOADS_FOLDER = 'downloads';
const TMP_FOLDER = 'tmp';
const APPS_FOLDER = 'apps';
const DEFAULT_PLUGINS_SANDBOX_PATH = '../../../sandbox';

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
    private _pluginsCfgFolder: string = '';
    private _app: string = '';
    private _root: string = '';
    private _exec: string = '';
    private _launcher: string = '';
    private _cli: string = '';
    private _appModules: string = '';
    private _resources: string = '';
    private _sockets: string = '';
    private _streams: string = '';
    private _downloads: string = '';
    private _tmp: string = '';
    private _apps: string = '';
    private _rg: string = '';
    private _includedPlugins: string = '';

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
            this._tmp = Path.resolve(this._home, TMP_FOLDER);
            this._apps = Path.resolve(this._home, APPS_FOLDER);
            this._pluginsCfgFolder = Path.resolve(this._home, PLUGINS_CONFIG_FOLDER);
            const resources: Error | string = this._getResourcePath();
            if (resources instanceof Error) {
                return reject(resources);
            }
            this._resources = resources;
            const root: string | Error = this._getRootPath();
            if (root instanceof Error) {
                return reject(root);
            }
            this._app = root;
            this._root = root;
            this._exec = app.getPath('exe');
            this._launcher = Path.resolve(Path.dirname(this._exec), `chipmunk${OS.platform() === 'win32' ? '.exe' : ''}`);
            this._cli = Path.resolve(this._root, `apps/cm${OS.platform() === 'win32' ? '.exe' : ''}`);
            this._includedPlugins = Path.resolve(this._root, 'plugins');
            this._appModules = Path.resolve(this._root, '../../node_modules');
            this._rg = Path.resolve(this._root, `apps/${OS.platform() === 'win32' ? 'rg.exe' : 'rg'}`);
            this._plugins = this._getPluginsPath(root);
            this._createHomeFolder().then(() => {
                Promise.all([this._home, this._plugins, this._sockets, this._streams, this._downloads, this._tmp, this._apps, this._pluginsCfgFolder].map((folder: string) => {
                    return this._mkdir(folder);
                })).then(() => {
                    this._logger.debug(`Paths:\n\thome: ${this._home}\n\troot: ${this._root}\n\tapp: ${this._app}\n\texec ${this._exec}\n\tlauncher ${this._launcher}\n\tcli ${this._cli}\n\tresources ${this._resources}\n\tplugins ${this._plugins}\n\tplugins settings ${this._pluginsCfgFolder}\n\tincluded plugins ${this._includedPlugins}\n\tsockets ${this._sockets}\n\tstreams ${this._streams}\n\tmodules ${this._appModules}`);
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
    public getIncludedPlugins(): string {
        return this._includedPlugins;
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
     * Returns path to plugins configuration folder
     * @returns string
     */
    public getPluginsCfgFolder(): string {
        return this._pluginsCfgFolder;
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
     * Returns path to tmp folder
     * @returns string
     */
    public getTmp(): string {
        return this._tmp;
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
     * Returns path to launcher executable file
     * @returns string
     */
    public getLauncher(): string {
        return this._launcher;
    }

    /**
     * Returns path to CLI executable file
     * @returns string
     */
    public getCLI(): string {
        return this._cli;
    }

    public getCLIPath(): string {
        return Path.dirname(this._cli);
    }
    /**
     * Returns path to ripgrep module
     * @returns string
     */
    public getRG(): string {
        return this._rg;
    }

    /**
     * Returns path to included resources
     * @returns string
     */
    public getResources(): string {
        return Path.resolve(this._resources, 'app/resources');
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
     * @MacOS only
     * Check is application file (chipmunk.app) located in system folder like "tmp" or "Downloads".
     * @returns boolean
     */
     public doesLocatedInSysFolder(): boolean {
        if (process.platform !== 'darwin') {
            return false;
        }
        if (this.getRoot().indexOf('/private/var/folders') === 0 && this.getRoot().indexOf('AppTranslocation') !== -1) {
            return true;
        } else {
            return false;
        }
    }

    /**
     * Creates logviewer folder (if it's needed)
     * @returns Promise<void>
     */
    private _createHomeFolder(): Promise<void> {
        return this._mkdir(this._home);
    }

    private _getPluginsPath(root: string): string {
        if (ServiceProduction.isProduction()) {
            return Path.resolve(this._home, PLUGINS_FOLDER);
        }
        const path: string | undefined = ServiceEnv.get().CHIPMUNK_PLUGINS_SANDBOX;
        if (path === undefined) {
            return Path.resolve(root, DEFAULT_PLUGINS_SANDBOX_PATH);
        }
        if (!FS.isExist(Path.resolve(path))) {
            this._logger.warn(`Fail to find custom SANDBOX path "${Path.resolve(path)}". Will be used default path.`);
            return Path.resolve(root, DEFAULT_PLUGINS_SANDBOX_PATH);
        }
        return Path.resolve(path);
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
