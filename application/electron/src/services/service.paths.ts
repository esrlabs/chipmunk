import * as OS from 'os';
import * as Path from 'path';
import * as FS from '../../platform/node/src/fs';

import Logger from '../../platform/node/src/env.logger';

import { IService } from '../../src/interfaces/interface.service';

const HOME_FOLDER = '.logviewer';

/**
 * @class ServicePaths
 * @description Gives paths to electron instance
 */

class ServicePaths implements IService {

    private _logger: Logger = new Logger('ServicePaths');
    private _home: string;
    private _app: string;
    private _root: string;
    private _resources: string;

    constructor() {
        this._home = Path.resolve(OS.homedir(), HOME_FOLDER);
        this._resources = process.resourcesPath as string;
        const root: string | Error = this._getRootPath();
        if (root instanceof Error) {
            throw root;
        }
        this._app = root;
        this._root = Path.resolve(root, '..');
    }

    /**
     * Initialization function
     * @returns Promise<void>
     */
    public init(): Promise<void> {
        return new Promise((resolve, reject) => {
            this._createFolder().then(() => {
                this._logger.env(`Paths:\n\thome: ${this._home}\n\troot: ${this._root}\n\tapp: ${this._app}\n\tresources ${this._resources}`);
                resolve();
            }).catch(reject);
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
     * Returns path from home perspective
     * @returns string
     */
    public resoveHomeFolder(folder: string): string {
        return Path.normalize(Path.resolve(this._home, folder));
    }

    /**
     * Creates logviewer folder (if it's needed)
     * @returns Promise<void>
     */
    private _createFolder(): Promise<void> {
        return new Promise((resolve, reject) => {
            if (FS.isExist(this._home)) {
                return resolve();
            }
            FS.mkdir(this._home).then(() => {
                resolve();
            }).catch((error: Error) => {
                this._logger.error(`Fail to create local logviewer folder "${this._home}" due error: ${error.message}`);
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

}

export default (new ServicePaths());
