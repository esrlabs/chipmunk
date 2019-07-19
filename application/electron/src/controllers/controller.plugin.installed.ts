import * as path from 'path';
import * as FS from '../tools/fs';
import Logger from '../tools/env.logger';
import ServicePaths from '../services/service.paths';
import ControllerPluginPackage, { IPackageJson } from '../controllers/controller.plugin.package';
import ControllerPluginVersions from './controller.plugin.versions';

export interface IPluginBasic {
    process: ControllerPluginPackage | undefined;
    render: ControllerPluginPackage | undefined;
    name: string;
    path: string;
}

export type TPluginName = string;

export const CPluginsFolders = {
    process: 'process',
    render: 'render',
};

/**
 * @class ControllerPluginInstalled
 * @description Delivery default plugins into logviewer folder
 */

export default class ControllerPluginInstalled {

    private _logger: Logger = new Logger('ControllerPluginInstalled');
    private _path: string = ServicePaths.getPlugins();

    /**
     * Walking plugin's folder and read all plugins inside and scans package.json file
     * @returns { Promise<Map<TPluginPath, IPlugin>> }
     */
    public getAll(): Promise<IPluginBasic[]> {
        return new Promise((resolve, reject) => {
            const plugins: IPluginBasic[] = [];
            // Get all sub folders from plugins folder. Expecting: there are plugins folders
            FS.readFolders(this._path).then((folders: string[]) => {
                if (folders.length === 0) {
                    // No any plugins
                    this._logger.env(`No any plugins were found. Target folder: ${this._path}`);
                    return resolve(plugins);
                }
                const toBeRemoved: string[] = [];
                // Check each plugin folder and read package.json of render and process apps
                Promise.all(folders.map((folder: string) => {
                    const fullPathToPlugin: string = path.resolve(this._path, folder);
                    return this._read(fullPathToPlugin).then((plugin: IPluginBasic) => {
                        if (plugin.process === undefined && plugin.render === undefined) {
                            this._logger.warn(`Plugin "${folder}" doesn't have definition not for process, not for render. Plugin will be dropped.`);
                            toBeRemoved.push(fullPathToPlugin);
                            return;
                        }
                        plugins.push({
                            name: folder,
                            path: fullPathToPlugin,
                            process: plugin.process,
                            render: plugin.render,
                        });
                    });
                })).then(() => {
                    this._remove(toBeRemoved).then(() => {
                        resolve(plugins);
                    }).catch((removeError: Error) => {
                        reject(new Error(this._logger.error(`Fail to remove plugins due errors: ${removeError.message}`)));
                    });
                }).catch((errorReading: Error) => {
                    reject(new Error(this._logger.error(`Unexpected error during initialization of plugin: ${errorReading.message}`)));
                });
            }).catch((error: Error) => {
                reject(new Error(this._logger.error(`Fail to read plugins folder (${this._path}) due error: ${error.message}.`)));
            });
        });
    }

    private _read(folder: string): Promise<IPluginBasic> {
        return new Promise((resolve) => {
            const paths = {
                process: path.resolve(folder, CPluginsFolders.process),
                render: path.resolve(folder, CPluginsFolders.render),
            };
            const plugin: IPluginBasic = {
                process: FS.isExist(paths.process) ? new ControllerPluginPackage(paths.process) : undefined,
                render: FS.isExist(paths.render) ? new ControllerPluginPackage(paths.render) : undefined,
                name: '',
                path: '',
            };
            Promise.all([
                new Promise((readignProcessResolve) => {
                    if (plugin.process === undefined) {
                        return readignProcessResolve();
                    }
                    plugin.process.read().then((packageJson: IPackageJson) => {
                        const versionErr: Error | undefined = ControllerPluginVersions.getVersionError(packageJson.version);
                        if (versionErr instanceof Error) {
                            plugin.process = undefined;
                            this._logger.warn(`Plugin "${paths.process}" has invalid definition of version: ${versionErr.message}`);
                        }
                        readignProcessResolve();
                    }).catch((error: Error) => {
                        plugin.process = undefined;
                        this._logger.warn(`Fail to read package.json in "${paths.process}" due error: ${error.message}`);
                        readignProcessResolve();
                    });
                }),
                new Promise((readignRenderResolve) => {
                    if (plugin.render === undefined) {
                        return readignRenderResolve();
                    }
                    plugin.render.read().then((packageJson: IPackageJson) => {
                        const versionErr: Error | undefined = ControllerPluginVersions.getVersionError(packageJson.version);
                        if (versionErr instanceof Error) {
                            plugin.render = undefined;
                            this._logger.warn(`Plugin "${paths.render}" has invalid definition of version: ${versionErr.message}`);
                        }
                        readignRenderResolve();
                    }).catch((error: Error) => {
                        plugin.render = undefined;
                        this._logger.warn(`Fail to read package.json in "${paths.render}" due error: ${error.message}`);
                        readignRenderResolve();
                    });
                }),
            ]).then(() => {
                resolve(plugin);
            });
        });
    }

    private _remove(folders: string[]): Promise<void> {
        return new Promise((resolve, reject) => {
            if (folders.length === 0) {
                resolve();
            }
            Promise.all(folders.map((folder: string) => {
                return FS.rmdir(folder).then(() => {
                    this._logger.env(`Plugiin "${folder}" was removed.`);
                });
            })).then(() => {
                resolve();
            }).catch(reject);
        });
    }
}
