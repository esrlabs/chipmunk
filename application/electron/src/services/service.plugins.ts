import * as Path from 'path';
import * as FS from '../tools/fs';
import * as Net from 'net';
import * as util from 'util';
import Logger from '../tools/env.logger';
import { guid } from '../tools/index';
import ServiceElectron from './service.electron';
import ServiceElectronService from './service.electron.state';
import ControllerPluginProcessMultiple from '../controllers/plugins/plugin.process.multiple';
import ControllerPluginProcessSingle from '../controllers/plugins/plugin.process.single';
import ControllerIPCPlugin from '../controllers/plugins/plugin.process.ipc';
import ControllerPluginDefaults, { IPluginDefaultInfo } from '../controllers/plugins/plugins.defaults';
import ControllerPluginPackage, { EProcessPluginType } from '../controllers/plugins/plugin.package';
import ControllerPluginInstalled, { IPluginBasic, TPluginName } from '../controllers/plugins/plugin.installed';
import ControllerPluginVersions from '../controllers/plugins/plugins.versions';

import * as npm from '../tools/npm.tools';
import { IService } from '../interfaces/interface.service';
import { IPCMessages, Subscription } from './service.electron';

export interface IPlugin {
    name: string;
    root: string;
    error?: Error;
    packages: {
        process: ControllerPluginPackage | undefined;
        render: ControllerPluginPackage | undefined;
    };
    sessions: Map<string, ControllerPluginProcessMultiple>;
    verified: {
        process: boolean;
        render: boolean;
    };
    info: {
        renderSent: boolean;
        renderLocation: string;
    };
    token: string;
    id: number;
    connections: symbol[];
    single: ControllerPluginProcessSingle | undefined;
}

type TConnectionFactory = (pluginId: string) => Promise<{ socket: Net.Socket, file: string }>;

/**
 * @class ServicePluginNode
 * @description Looking for plugins, which should be attached on nodejs level
 */
export class ServicePlugins implements IService {

    private _logger: Logger = new Logger('ServicePluginNode');
    private _plugins: Map<TPluginName, IPlugin> = new Map();
    private _electronVersion: string = '';
    private _subscriptions: { [key: string ]: Subscription } = { };
    private _isRenderReady: boolean = false;
    private _seq: number = 0;
    private _ids: Map<number, string> = new Map();
    private _controllerInstalled: ControllerPluginInstalled | undefined;
    private _controllerDefaults: ControllerPluginDefaults | undefined;

    constructor() {
        this._ipc_onRenderState = this._ipc_onRenderState.bind(this);
    }

    /**
     * Initialization function
     * @returns { Promise<void> }
     */
    public init(): Promise<void> {
        return new Promise((resolve, reject) => {
            // Create controllers
            this._controllerInstalled = new ControllerPluginInstalled();
            this._controllerDefaults = new ControllerPluginDefaults();
            // Subscribe to render events
            this._subscribeIPCMessages();
            // Get electron version
            const version = ServiceElectron.getVersion();
            if (version instanceof Error) {
                return reject(version);
            }
            this._electronVersion = version;
            let installed: IPluginBasic[] = [];
            let defaults: IPluginDefaultInfo[] = [];
            Promise.all([
                new Promise((resolveInstalledPlugins, rejectInstalledPlugins) => {
                    if (this._controllerInstalled === undefined) {
                        return reject(new Error(`Controller ControllerPluginInstalled isn't created`));
                    }
                    this._controllerInstalled.getAll().then((plugins: IPluginBasic[]) => {
                        installed = plugins;
                        resolveInstalledPlugins();
                    }).catch((readingDescriptionsError: Error) => {
                        ServiceElectronService.logStateToRender(`Fail to get description of available plugins due error: ${readingDescriptionsError.message}`);
                        rejectInstalledPlugins(new Error(this._logger.error(`Fail to get description of available plugins due error: ${readingDescriptionsError.message}`)));
                    });
                }),
                new Promise((resolveIncludedPlugins, rejectIncludedPlugins) => {
                    if (this._controllerDefaults === undefined) {
                        return reject(new Error(`Controller ControllerPluginDefaults isn't created`));
                    }
                    this._controllerDefaults.getAll().then((plugins: IPluginDefaultInfo[]) => {
                        defaults = plugins;
                        resolveIncludedPlugins();
                    }).catch((readingDescriptionsError: Error) => {
                        ServiceElectronService.logStateToRender(`Fail to get description of available plugins due error: ${readingDescriptionsError.message}`);
                        rejectIncludedPlugins(new Error(this._logger.error(`Fail to get description of available plugins due error: ${readingDescriptionsError.message}`)));
                    });
                }),
            ]).then(() => {
                // Checks versions of plugins
                const hasToBeUpdated: IPluginBasic[] = [];
                const toBeDelivered: IPluginDefaultInfo[] = [];
                defaults.forEach((defaultPlugin: IPluginDefaultInfo) => {
                    let found: boolean = false;
                    installed.forEach((plugin: IPluginBasic) => {
                        if (defaultPlugin.name === plugin.name) {
                            found = true;
                            const deafultPluginRate: number = ControllerPluginVersions.getVersionRate(defaultPlugin.version);
                            // Note: controller.plugin.installed do not allow undefined process and render. So, if process === undefined, render cannot be undefined anyhow
                            const installedPluginVersion: string = plugin.process !== undefined ? plugin.process.getPackageJson().version : (plugin.render as ControllerPluginPackage).getPackageJson().version;
                            const installedPlulingRate: number = ControllerPluginVersions.getVersionRate(installedPluginVersion);
                            if (deafultPluginRate > installedPlulingRate) {
                                // Plugin has to be updated
                                hasToBeUpdated.push(plugin);
                                toBeDelivered.push(defaultPlugin);
                            }
                        }
                    });
                    if (!found) {
                        toBeDelivered.push(defaultPlugin);
                    }
                });
                // Remove plugins, which should be updated
                Promise.all(hasToBeUpdated.map((plugin: IPluginBasic) => {
                    return FS.rmdir(plugin.path).then(() => {
                        ServiceElectronService.logStateToRender(this._logger.debug(`Plugin "${plugin.name}" was removed because new version is in package.`));
                    });
                })).then(() => {
                    if (this._controllerDefaults === undefined) {
                        return reject(new Error(`Controller ControllerPluginDefaults isn't created`));
                    }
                    this._controllerDefaults.delivery(toBeDelivered).then(() => {
                        if (this._controllerInstalled === undefined) {
                            return reject(new Error(`Controller ControllerPluginInstalled isn't created`));
                        }
                        // Read all plugins once again
                        this._controllerInstalled.getAll().then((plugins: IPluginBasic[]) => {
                            if (plugins.length === 0) {
                                // No plugins to be initialized
                                ServiceElectronService.logStateToRender(this._logger.debug(`No plugins installed`));
                                return resolve();
                            }
                            // Store plugins data
                            plugins.forEach((plugin: IPluginBasic) => {
                                this._plugins.set(plugin.name, this._getPluginObj(plugin));
                            });
                            // Initialize plugins
                            this._initializeAllPlugins().then(() => {
                                ServiceElectronService.logStateToRender(this._logger.debug(`All plugins are ready`));
                                this._sendRenderPluginsData();
                                // Attach single plugins
                                this._initSingleSessionPlugins().then(() => {
                                    // All done now
                                    console.log(this.getSessionPluginsNames());
                                    resolve();
                                });
                            }).catch((initializationError: Error) => {
                                ServiceElectronService.logStateToRender(this._logger.error(`Error during initialization of plugins: ${initializationError.message}`));
                                this._sendRenderPluginsData();
                                this._initSingleSessionPlugins().then(() => {
                                    // All done now
                                    resolve();
                                });
                            });
                        }).catch((rereadingError: Error) => {
                            ServiceElectronService.logStateToRender(this._logger.warn(`Fail to reread available plugins due error: ${rereadingError.message}`));
                            resolve();
                        });
                    }).catch((deliveryError: Error) => {
                        // Resolve in any way to continue
                        ServiceElectronService.logStateToRender(this._logger.warn(`Fail to delivery updated plugins due error: ${deliveryError.message}`));
                        resolve();
                    });
                }).catch((removeError: Error) => {
                    // Resolve in any way to continue
                    ServiceElectronService.logStateToRender(this._logger.warn(`Fail to update plugins due error: ${removeError.message}`));
                    resolve();
                });
            }).catch((error: Error) => {
                // Resolve in any way to continue
                ServiceElectronService.logStateToRender(this._logger.warn(`Fail to initialize plugins due error: ${error.message}`));
                resolve();
            });
        });
    }

    public destroy(): Promise<void> {
        return new Promise((resolve) => {
            Object.keys(this._subscriptions).forEach((key: string) => {
                (this._subscriptions as any)[key].destroy();
            });
            this._plugins.forEach((plugin: IPlugin) => {
                plugin.sessions.forEach((controller: ControllerPluginProcessMultiple) => {
                    controller.kill();
                });
            });
            resolve();
        });
    }

    public getName(): string {
        return 'ServicePackage';
    }

    public getPluginToken(id: number): string | undefined {
        return this._ids.get(id);
    }

    public getPluginName(id: number): string | undefined {
        const token: string | undefined = this._ids.get(id);
        if (token === undefined) {
            return undefined;
        }
        const plugin: IPlugin | undefined = this._getPluginInfoByToken(token);
        if (plugin === undefined) {
            return undefined;
        }
        return plugin.name;
    }

    public getPluginIPC(session: string, token: string): ControllerIPCPlugin | undefined {
        const plugin: IPlugin | undefined = this._getPluginInfoByToken(token);
        if (plugin === undefined) {
            return undefined;
        }
        const controller: ControllerPluginProcessMultiple | undefined = plugin.sessions.get(session);
        if (controller === undefined) {
            return undefined;
        }
        const IPC: ControllerIPCPlugin | Error = controller.getIPC();
        if (IPC instanceof Error) {
            this._logger.warn(`Fail to get IPC of plugin "${plugin.name}" due error: ${IPC.message}`);
            return undefined;
        }
        return IPC;
    }

    /* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
    *   Redirection of messages
    * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
    public redirectIPCMessageToPluginHost(message: IPCMessages.PluginInternalMessage, sequence?: string) {
        const target: IPlugin | undefined = this._getPluginInfoByToken(message.token);
        if (target === undefined) {
            return this._logger.error(`Fail to find plugin by token: ${message.token}. Income message: ${message.data}`);
        }
        let controller: ControllerPluginProcessMultiple | ControllerPluginProcessSingle | undefined;
        if (target.single instanceof ControllerPluginProcessSingle) {
            controller = target.single;
        } else {
            controller = target.sessions.get(message.stream);
        }
        if (controller === undefined) {
            return this._logger.error(`Fail redirect message by token ${message.token}, because plugin doesn't have process for session "${message.stream}". Income message: ${util.inspect(message.data)}`);
        }
        const ipc = controller.getIPC();
        if (ipc instanceof Error) {
            return this._logger.error(`Fail redirect message by token ${message.token} due error: ${ipc.message}`);
        }
        ipc.send(message, sequence).catch((sendingError: Error) => {
            this._logger.error(`Fail redirect message by token ${message.token} due error: ${sendingError.message}`);
        });
    }

    /* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
    *   Streams
    * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */

    public addStream(streamId: string, connectionFactory: TConnectionFactory): Promise<void> {
        return new Promise((resolve, reject) => {
            const plugins: IPlugin[] = [];
            const singles: IPlugin[] = [];
            this._logger.debug(`New stream is created ${streamId}. Sending information to plugins.`);
            this._plugins.forEach((plugin: IPlugin) => {
                if (plugin.single !== undefined) {
                    singles.push(plugin);
                } else {
                    if (plugin.sessions.has(streamId)) {
                        this._logger.warn(`Plugin ${plugin.name} was defined as transport for session "${streamId}", but plugin is already bound with this session.`);
                        return;
                    }
                    plugins.push(plugin);
                }
            });
            const tasks: Array<Promise<void>> = [];
            // Init per session plugins (mulitple)
            tasks.push(...plugins.map((plugin: IPlugin) => {
                return new Promise<void>((resolveTask, rejectTask) => {
                    // Create controller
                    const controller: ControllerPluginProcessMultiple = new ControllerPluginProcessMultiple(plugin);
                    if (!controller.canBeAttached()) {
                        return resolveTask();
                    }
                    controller.attach().then(() => {
                        // Binding controller
                        connectionFactory(plugin.name).then((connection: { socket: Net.Socket, file: string }) => {
                            // Send data to plugin
                            controller.bindStream(streamId, connection).then(() => {
                                plugin.sessions.set(streamId, controller);
                                // Save data
                                this._plugins.set(plugin.name, plugin);
                                // Send notification
                                ServiceElectronService.logStateToRender(`[${plugin.name}]: attached to session "${streamId}".`);
                                this._logger.debug(`[${plugin.name}]: attached to session "${streamId}"`);
                                resolveTask();
                            }).catch((bindError: Error) => {
                                ServiceElectronService.logStateToRender(`[${plugin.name}]: fail to bind due error: ${bindError.message}`);
                                this._logger.warn(`Fail to bind plugin ${plugin.name} due error: ${bindError.message}.`);
                                rejectTask(bindError);
                            });
                        });
                    }).catch((attachError: Error) => {
                        ServiceElectronService.logStateToRender(`[${plugin.name}]: fail to attach due error: ${attachError.message}`);
                        this._logger.warn(`Fail to attach plugin ${plugin.name} for session "${streamId}" due error: ${attachError.message}.`);
                        rejectTask(attachError);
                    });
                });
            }));
            // Init single plugins (single)
            tasks.push(...singles.map((plugin: IPlugin) => {
                return new Promise<void>((resolveTask, rejectTask) => {
                    const controller: ControllerPluginProcessSingle = plugin.single as ControllerPluginProcessSingle;
                    if (!controller.isAttached()) {
                        this._logger.warn(`Plugin "${plugin.name}" is defined as single, but wasn't atteched. This plugin will be ignored for session "${streamId}"`);
                        return resolveTask();
                    }
                    // Binding controller
                    connectionFactory(plugin.name).then((connection: { socket: Net.Socket, file: string }) => {
                        // Send data to plugin
                        controller.bindStream(streamId, connection).then(() => {
                            // Send notification
                            ServiceElectronService.logStateToRender(`[${plugin.name}]: attached to session "${streamId}".`);
                            this._logger.debug(`[${plugin.name}]: attached to session "${streamId}"`);
                            resolveTask();
                        }).catch((bindError: Error) => {
                            ServiceElectronService.logStateToRender(`[${plugin.name}]: fail to bind due error: ${bindError.message}`);
                            this._logger.warn(`Fail to bind plugin ${plugin.name} due error: ${bindError.message}.`);
                            rejectTask(bindError);
                        });
                    });
                });
            }));
            if (tasks.length === 0) {
                return resolve();
            }
            // Do all
            Promise.all(tasks).then(() => {
                this._logger.debug(`All plugins for session "${streamId}" is attached and bound.`);
                resolve();
            }).catch((error: Error) => {
                reject(error);
            });
        });
    }

    public removedStream(streamId: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const tasks: Array<Promise<void>> = [];
            // Find all plugins, which are bound with stream
            this._plugins.forEach((plugin: IPlugin, id: string) => {
                if (plugin.single === undefined) {
                    // Mulitple plugins (plugins per session)
                    const controller: ControllerPluginProcessMultiple | undefined = plugin.sessions.get(streamId);
                    if (controller === undefined) {
                        return;
                    }
                    controller.kill();
                    plugin.sessions.delete(streamId);
                    this._plugins.set(id, plugin);
                } else {
                    // Single plugins (plugins for all sessions across)
                    const controller = plugin.single;
                    tasks.push(new Promise((resolveTask, rejectTask) => {
                        controller.unbindStream(streamId).then(resolveTask).catch(rejectTask);
                    }));
                }
            });
            if (tasks.length === 0) {
                return resolve();
            }
            Promise.all(tasks).then(() => {
                resolve();
            }).catch(reject);
        });
    }

    /* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
    *   Common
    * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
    public getSessionPluginsNames(): string[] {
        const plugins: string[] = [];
        this._plugins.forEach((desc: IPlugin) => {
            if (desc.single) {
                plugins.push(desc.name);
            }
        });
        return plugins;
    }
    private _getPluginInfoByToken(token: string): IPlugin | undefined {
        let result: IPlugin | undefined;
        this._plugins.forEach((plugin: IPlugin) => {
            if (result) {
                return;
            }
            if (plugin.token === token) {
                result = plugin;
            }
        });
        return result;
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
            if (plugin.packages.process !== undefined) {
                tasks.push(this._initializeProcessOfPlugin(plugin));
                // tasks.push(this._initializeProcessOfPlugin(plugin, true)); // Force reintall (debug)
            }
            if (plugin.packages.render !== undefined) {
                tasks.push(this._initializeRenderOfPlugin(plugin));
            }
            Promise.all(tasks).then(() => {
                ServiceElectronService.logStateToRender(`[${plugin.name}]: initialization of plugin is done.`);
                this._logger.debug(`[${plugin.name}]: initialization of plugin is done.`);
                resolve();
            }).catch((error: Error) => {
                ServiceElectronService.logStateToRender(`[${plugin.name}]: fail to initialize due error: ${error.message}.`);
                this._logger.warn(`[${plugin.name}]: fail to initialize due error: ${error.message}.`);
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
            const nodeModulesPath: string = Path.resolve((plugin.packages.process as ControllerPluginPackage).getPath(), './node_modules');
            if (FS.isExist(nodeModulesPath) && !reinstall) {
                ServiceElectronService.logStateToRender(`[${plugin.name}]: plugin is already installed.`);
                this._logger.debug(`[${plugin.name}]: plugin is already installed.`);
                return resolve(false);
            } else if (FS.isExist(nodeModulesPath) && reinstall) {
                ServiceElectronService.logStateToRender(`[${plugin.name}]: force reinstalation of plugin; node_modules will be removed.`);
                this._logger.debug(`[${plugin.name}]: force reinstalation of plugin; node_modules will be removed.`);
                FS.rmdir(nodeModulesPath).then(() => {
                    resolve(true);
                }).catch((error: Error) => {
                    reject(error);
                });
            } else {
                ServiceElectronService.logStateToRender(`[${plugin.name}]: plugin has to be installed.`);
                this._logger.debug(`[${plugin.name}]: plugin has to be installed.`);
                resolve(true);
            }
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
            this._logger.debug(`[${plugin.name}]: checking plugin.`);
            this._preinstalationProcessOfPlugin(plugin, reinstall).then((install: boolean) => {

                const initialize = () => {
                    plugin.verified.process = true;
                    this._plugins.set(plugin.name, plugin);
                    resolve();
                };

                if (install) {
                    ServiceElectronService.logStateToRender(`[${plugin.name}]: installing`);
                    this._logger.debug(`[${plugin.name}]: installing`);
                    npm.install((plugin.packages.process as ControllerPluginPackage).getPath()).then(() => {
                        ServiceElectronService.logStateToRender(`[${plugin.name}]: installation is complited.`);
                        ServiceElectronService.logStateToRender(`[${plugin.name}]: rebuild.`);
                        this._logger.debug(`[${plugin.name}]: installation is complited.`);
                        initialize();
                    }).catch((installationError: Error) => {
                        ServiceElectronService.logStateToRender(`[${plugin.name}]: Fail install due error: ${installationError.message}`);
                        this._logger.error(`[${plugin.name}]: Fail install due error: ${installationError.message}`);
                        reject(installationError);
                    });
                } else {
                    initialize();
                }
            }).catch((preinstallError: Error) => {
                ServiceElectronService.logStateToRender(`[${plugin.name}]: Fail to do preinstallation operations due error: ${preinstallError.message}`);
                this._logger.error(`[${plugin.name}]: Fail to do preinstallation operations due error: ${preinstallError.message}`);
                reject(preinstallError);
            });
        });
    }

    /* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
    *   Initialization of plugins: render part
    * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */

    /**
     * Verify plugin in part of render
     * @param {IPlugin} plugin description of plugin
     * @returns { Promise<void> }
     */
    private _initializeRenderOfPlugin(plugin: IPlugin): Promise<void> {
        return new Promise((resolve, reject) => {
            // Check "main" field of package.json
            if (plugin.packages.render === undefined) {
                return reject(new Error(this._logger.error(`[${plugin.name}]: plugin doesn't have render part.`)));
            }
            const mainField: string = plugin.packages.render.getPackageJson().main;
            // Check main file of plugin
            const mainFile: string = Path.normalize(Path.resolve((plugin.packages.render as ControllerPluginPackage).getPath(), mainField));
            if (!FS.isExist(mainFile)) {
                ServiceElectronService.logStateToRender(`[${plugin.name}]: Fail to find main file: "${mainField}" / "${mainFile}"`);
                return reject(new Error(this._logger.error(`[${plugin.name}]: Fail to find main file: "${mainField}" / "${mainFile}"`)));
            }
            // Mark plugin as verified
            plugin.verified.render = true;
            // Save location
            plugin.info.renderLocation = mainFile;
            // Update plugin info
            this._plugins.set(plugin.name, plugin);
            resolve();
        });
    }

    /* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
    *   Reading plugin's data
    * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */

    /**
     * Scan plugin folder for two subfolders: "process" (electron part) and "render" (render part). Search for each package.json; read it; save it into description
     * @param {string} name name of plugin
     * @param {string} path path to process's plugin
     * @returns { Promise<IPlugin> }
     */
    private _getPluginObj(basic: IPluginBasic): IPlugin {
        const obj: IPlugin = {
            name: basic.name,
            packages: {
                process: basic.process,
                render: basic.render,
            },
            root: basic.path,
            verified: {
                process: false,
                render: false,
            },
            info: {
                renderLocation: '',
                renderSent: false,
            },
            token: guid(),
            id: ++this._seq,
            connections: [],
            sessions: new Map(),
            single: undefined,
        };
        this._ids.set(obj.id, obj.token);
        return obj;
    }

    /* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
    *   Work with render process
    * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
    private _subscribeIPCMessages() {
        ServiceElectron.IPC.subscribe(IPCMessages.RenderState, this._ipc_onRenderState).then((subscription: Subscription) => {
            this._subscriptions.renderState = subscription;
        }).catch((error: Error) => {
            this._logger.warn(`Fail to subscribe to render event "RenderState" due error: ${error.message}. This is not blocked error, loading will be continued.`);
        });
    }

    /**
     * Handler render's state
     * @returns void
     */
    private _ipc_onRenderState(state: IPCMessages.TMessage) {
        if (!(state instanceof IPCMessages.RenderState)) {
            return;
        }
        if (state.state !== IPCMessages.ERenderState.ready) {
            return;
        }
        this._isRenderReady = true;
        // Send infomation about verified plugins
        this._sendRenderPluginsData();
    }

    private _sendRenderPluginsData() {
        if (!this._isRenderReady) {
            return;
        }
        const plugins: IPCMessages.IRenderMountPluginInfo[] = [];
        let names: string = '';
        this._plugins.forEach((plugin: IPlugin) => {
            if (!plugin.verified.render) {
                // Plugin isn't verified
                return;
            }
            if (plugin.info.renderSent) {
                // Information about plugin was already sent
                return;
            }
            names += `${plugin.name}; `;
            plugins.push({
                name: plugin.name,
                location: plugin.info.renderLocation,
                token: plugin.token,
                id: plugin.id,
            });
        });
        // Inform render about plugin location
        ServiceElectron.IPC.send(new IPCMessages.RenderMountPlugin({
            plugins: plugins,
        })).then(() => {
            if (this._plugins.size === 0) {
               return;
            }
            this._logger.debug(`Information about plugin "${names}" was sent to render`);
        }).catch((sendingError: Error) => {
            ServiceElectronService.logStateToRender(`Fail to send information to render about plugin "${names}" due error: ${sendingError.message}`);
            this._logger.error(`Fail to send information to render about plugin "${names}" due error: ${sendingError.message}`);
        });
    }

    private _initSingleSessionPlugins(): Promise<void> {
        return new Promise((resolve) => {
            const plugins: IPlugin[] = [];
            this._plugins.forEach((plugin: IPlugin) => {
                if (plugin.packages.process === undefined) {
                    return;
                }
                if (plugin.packages.process.getPackageJson().logviewer.type !== EProcessPluginType.single) {
                    return;
                }
                plugins.push(plugin);
            });
            if (plugins.length === 0) {
                return resolve();
            }
            Promise.all(plugins.map((plugin: IPlugin) => {
                return new Promise((resolvePlugin) => {
                    const controller = new ControllerPluginProcessSingle(plugin);
                    controller.attach().then(() => {
                        plugin.single = controller;
                        this._plugins.set(plugin.name, plugin);
                        this._logger.debug(`Plugin "${plugin.name}" is attached as single plugin.`);
                        resolvePlugin();
                    }).catch((attachError: Error) => {
                        this._logger.warn(`Fail to attach plugin "${plugin.name}" due error: ${attachError.message}`);
                        // Resolve in any way
                        resolvePlugin();
                    });
                });
            })).then(() => {
                resolve();
            });
        });
    }

}

export default (new ServicePlugins());
