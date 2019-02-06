import * as Path from 'path';
import * as Objects from '../../platform/cross/src/env.objects';
import * as FS from '../../platform/node/src/fs';

import { ChildProcess, fork } from 'child_process';

import Logger from '../../platform/node/src/env.logger';
import NPMInstaller from '../tools/npm.installer';
import ServiceElectron from './service.electron';
import ServicePaths from './service.paths';

import ControllerPluginProcess from '../controllers/controller.plugin.process';

import { IService } from '../interfaces/interface.service';

import ElectronRebuild from 'electron-rebuild';

const PROCESS_FOLDER = 'process';
const RENDER_FOLDER = 'render';

export interface IPlugin {
    name: string;
    root: string;
    path: {
        process: string;
        render: string;
    };
    process: boolean;
    render: boolean;
    error?: Error;
    packages: {
        process: any;
        render: any;
    };
    node?: {
        controller: ControllerPluginProcess;
        started: number;
    };
}

export type TPluginPath = string;

/**
 * @class ServicePluginNode
 * @description Looking for plugins, which should be attached on nodejs level
 */

export class ServicePlugins implements IService {

    private _logger: Logger = new Logger('ServicePluginNode');
    private _path: string = ServicePaths.getPlugins();
    private _plugins: Map<TPluginPath, IPlugin> = new Map();
    private _electronVersion: string = '';

    /**
     * Initialization function
     * @returns { Promise<void> }
     */
    public init(): Promise<void> {
        return new Promise((resolve, reject) => {
            // Get electron version
            const version = ServiceElectron.getVersion();
            if (version instanceof Error) {
                return reject(version);
            }
            this._electronVersion = version;
            // Get description of all plugins
            this._getAllPluginDescription().then((plugins: Map<TPluginPath, IPlugin>) => {
                this._plugins = plugins;
                if (plugins.size === 0) {
                    // No plugins to be initialized
                    return resolve();
                }
                this._initializeAllPlugins().then(() => {
                    resolve();
                }).catch((initializationError: Error) => {
                    this._logger.error(`Error during initialization of plugins: ${initializationError.message}`);
                    resolve();
                });
            }).catch((readingDescriptionsError: Error) => {
                this._logger.error(`Fail to get description of available plugins due error: ${readingDescriptionsError.message}`);
                resolve();
            });
        });
    }

    public getName(): string {
        return 'ServicePackage';
    }

    /* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
    *   Initialization of plugins
    * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
    /**
     * Start initialization of all found plugins. Initialize and process and render
     * @returns { Promise<void> }
     */
    private _initializeAllPlugins(): Promise<void> {
        return new Promise((resolve, reject) => {
            Promise.all(Array.from(this._plugins.values()).map((plugin: IPlugin) => {
                return this._initializePlugin(plugin);
            })).then(() => {
                resolve();
            }).catch(reject);
        });
    }

    /**
     * Make attempt to install plugin. Can be:
     * (a) plugin is already installed and in this case it will be inited only;
     * (b) plugin isn't installed. In this case it will be installed and inited after;
     *
     * Each plugin can have two parts:
     * (a) process - part, which inited on node/electron level as forked process
     * (b) render - part, which inited on browser/angular level as injected component
     *
     * Plugin can has both parts: process and render. Or just some one part.
     * @returns { Promise<void> }
     */
    private _initializePlugin(plugin: IPlugin): Promise<void> {
        return new Promise((resolve, reject) => {
            const tasks: Array<Promise<void>> = [];
            if (plugin.process) {
                tasks.push(this._initializeProcessOfPlugin(plugin));
            }
            if (plugin.render) {
                tasks.push(this._initializeRenderOfPlugin(plugin));
            }
            Promise.all(tasks).then(() => {
                this._logger.env(`[${plugin.name}]: initialization of plugin is done.`);
                resolve();
            }).catch((error: Error) => {
                this._logger.env(`[${plugin.name}]: fail to initialize due error: ${error.message}.`);
                reject(error);
            });
        });
    }

    /* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
    *   Initialization of plugins: process part
    * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
    /**
     * Does preinstalations checks:
     * - is plugin installed or not
     * - has to be reinstalled or not
     *
     * Does next actions:
     * - remove whole node_modules folder if plugin should be reinstalled
     * @param {IPlugin} plugin description of plugin
     * @param {boolean} reinstall flag to force reinstallation process: true - reinstall.
     * @returns { Promise<boolean> } true - plugin has to be installed; false - plugin is already installed
     */
    private _preinstalationProcessOfPlugin(plugin: IPlugin, reinstall: boolean = false): Promise<boolean> {
        return new Promise((resolve, reject) => {
            const nodeModulesPath: string = Path.resolve(plugin.path.process, './node_modules');
            if (FS.isExist(nodeModulesPath) && !reinstall) {
                this._logger.env(`[${plugin.name}]: plugin is already installed.`);
                return resolve(false);
            } else if (FS.isExist(nodeModulesPath) && reinstall) {
                this._logger.env(`[${plugin.name}]: force reinstalation of plugin; node_modules will be removed.`);
                FS.rmdir(nodeModulesPath).then(() => {
                    resolve(true);
                }).catch((error: Error) => {
                    reject(error);
                });
            } else {
                this._logger.env(`[${plugin.name}]: plugin has to be installed.`);
                resolve(true);
            }
        });
    }

    /**
     * Create controller of plugin's process
     * Controller of plugin's process attachs plugins as forked process and provide communitin within it
     * @param {IPlugin} plugin description of plugin
     * @returns { Promise<ControllerPluginProcess> }
     */
    private _attachProcessOfPlugin(plugin: IPlugin): Promise<ControllerPluginProcess> {
        return new Promise((resolve, reject) => {
            const process: ControllerPluginProcess = new ControllerPluginProcess(plugin);
            process.attach().then(() => {
                this._logger.env(`[${plugin.name}]: attached.`);
                resolve(process);
            }).catch((attachError: Error) => {
                this._logger.error(`[${plugin.name}]: fail to attach due error: ${attachError.message}`);
                reject();
            });
        });
    }

    /**
     * Install and init plugin in part of process
     * @param {IPlugin} plugin description of plugin
     * @param {boolean} reinstall flag to force reinstallation process: true - reinstall.
     * @returns { Promise<void> }
     */
    private _initializeProcessOfPlugin(plugin: IPlugin, reinstall: boolean = false): Promise<void> {
        return new Promise((resolve, reject) => {
            this._logger.env(`[${plugin.name}]: checking plugin.`);
            this._preinstalationProcessOfPlugin(plugin, reinstall).then((install: boolean) => {

                const initialize = () => {
                    this._attachProcessOfPlugin(plugin).then((controller: ControllerPluginProcess) => {
                        // Save ref to controller and define start time
                        plugin.node = {
                            controller: controller,
                            started: Date.now(),
                        };
                        this._plugins.set(plugin.name, plugin);
                        resolve();
                    }).catch((attachError: Error) => {
                        reject(attachError);
                    });
                };

                if (install) {
                    this._logger.env(`[${plugin.name}]: start installation of plugin.`);
                    const npmInstaller: NPMInstaller = new NPMInstaller();
                    npmInstaller.install(plugin.path.process).then(() => {
                        this._logger.env(`[${plugin.name}]: installation is complited.`);
                        this._logger.env(`[${plugin.name}]: start rebuild.`);
                        ElectronRebuild({
                            buildPath: plugin.path.process,
                            electronVersion: this._electronVersion,
                        }).then(() => {
                            this._logger.env(`[${plugin.name}]: rebuild is complited.`);
                            initialize();
                        }).catch((rebuildError: Error) => {
                            this._logger.error(`[${plugin.name}]: Fail rebuild due error: ${rebuildError.message}`);
                            reject(rebuildError);
                        });
                    }).catch((installationError: Error) => {
                        this._logger.error(`[${plugin.name}]: Fail install due error: ${installationError.message}`);
                        reject(installationError);
                    });
                } else {
                    initialize();
                }
            }).catch((preinstallError: Error) => {
                this._logger.error(`[${plugin.name}]: Fail to do preinstallation operations due error: ${preinstallError.message}`);
                reject(preinstallError);
            });
        });
    }

    /* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
    *   Initialization of plugins: render part
    * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */

    private _initializeRenderOfPlugin(plugin: IPlugin): Promise<void> {
        return new Promise((resolve, reject) => {
            resolve();
        });
    }

    /* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
    *   Reading plugin's data
    * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
    /**
     * Walking plugin's folder and read all plugins inside and scans package.json file
     * @returns { Promise<Map<TPluginPath, IPlugin>> }
     */
    private _getAllPluginDescription(): Promise<Map<TPluginPath, IPlugin>> {
        return new Promise((resolve, reject) => {
            const plugins: Map<TPluginPath, IPlugin> = new Map();
            // Get all sub folders from plugins folder. Expecting: there are plugins folders
            FS.readFolders(this._path).then((folders: string[]) => {
                if (folders.length === 0) {
                    // No any plugins
                    this._logger.env(`No any plugins were found. Target folder: ${this._path}`);
                    return;
                }
                const errors: Error[] = [];
                // Check each plugin folder and read package.json of render and process apps
                Promise.all(folders.map((folder: string) => {
                    return this._getPluginDescription(folder, Path.resolve(this._path, folder)).then((desc: IPlugin) => {
                        if (desc.error) {
                            errors.push(desc.error);
                        } else {
                            plugins.set(desc.name, desc);
                        }
                    });
                })).then(() => {
                    if (errors.length > 0) {
                        this._logger.error(`Not all plugins were initialized due next errors: \n\t-\t${errors.map((e: Error) => e.message).join('\n\t-\t')}`);
                    }
                    const list: {
                        failed: string[],
                        success: string[],
                    } = {
                        failed: [],
                        success: [],
                    };
                    plugins.forEach((desc: IPlugin) => {
                        if (desc.error) {
                            list.failed.push(desc.root);
                        } else {
                            list.success.push(desc.root);
                        }
                    });
                    list.success.length > 0 && this._logger.env(`Successfuly read plugins: \n\t-\t${list.success.join(';\n\t-\t')}`);
                    list.failed.length > 0 && this._logger.env(`Failed to read plugins: \n\t-\t${list.failed.join(';\n\t-\t')}`);
                    resolve(plugins);
                }).catch((error: Error) => {
                    this._logger.error(`Unexpected error during initialization of plugin: ${error.message}`);
                    resolve(plugins);
                });
            }).catch((error: Error) => {
                this._logger.error(`Fail to read plugins folder (${this._path}) due error: ${error.message}. Application will continue work, but plugins weren't inited.`);
                // Plugins should not block application
                reject(plugins);
            });
        });
    }

    /**
     * Scan plugin folder for two subfolders: "process" (electron part) and "render" (render part). Search for each package.json; read it; save it into description
     * @param {string} name name of plugin
     * @param {string} path path to process's plugin
     * @returns { Promise<IPlugin> }
     */
    private _getPluginDescription(name: string, path: string): Promise<IPlugin> {
        return new Promise((resolve) => {
            const desc: IPlugin = {
                name: name,
                packages: {
                    process: undefined,
                    render: undefined,
                },
                path: {
                    process: Path.resolve(path, PROCESS_FOLDER),
                    render: Path.resolve(path, RENDER_FOLDER),
                },
                process: FS.isExist(Path.resolve(path, PROCESS_FOLDER)),
                render: FS.isExist(Path.resolve(path, RENDER_FOLDER)),
                root: path,
            };
            const tasks = [];
            if (desc.process) {
                tasks.push(this._readPackage(Path.resolve(path, PROCESS_FOLDER)).then((data: any) => {
                    desc.packages.process = data;
                }).catch((error: Error) => {
                    desc.error = new Error(`Fail to read plugin's package.json files for process due error: ${error.message}.`);
                }));
            }
            if (desc.render) {
                tasks.push(this._readPackage(Path.resolve(path, RENDER_FOLDER)).then((data: any) => {
                    desc.packages.render = data;
                }).catch((error: Error) => {
                    desc.error = new Error(`Fail to read plugin's package.json files for render due error: ${error.message}.`);
                }));
            }
            Promise.all(tasks).then(() => {
                resolve(desc);
            }).catch((error: Error) => {
                resolve(desc);
            });
        });
    }

    /**
     * Read package.json and try to parse as JSON
     * @param {string} folder destination folder with package.json file
     * @returns { Promise<any> }
     */
    private _readPackage(folder: string): Promise<any> {
        return new Promise((resolve, reject) => {
            if (!FS.isExist(folder)) {
                return reject(new Error(this._logger.error(`Folder "${folder}" doesn't exist`)));
            }
            const packageFile: string = Path.resolve(folder, 'package.json');
            if (!FS.isExist(packageFile)) {
                return reject(new Error(this._logger.error(`Package.json file "${packageFile}" doesn't exist`)));
            }
            FS.readTextFile(packageFile).then((content: string) => {
                const json = Objects.getJSON(content);
                if (json instanceof Error) {
                    return reject(new Error(this._logger.error(`Cannot parse package file "${packageFile}" due error: ${json.message}`)));
                }
                resolve(json);
            }).catch((error: Error) => {
                this._logger.error(`Fail to read package at "${packageFile}" due error: ${error.message}`);
            });
        });
    }

}

export default (new ServicePlugins());
