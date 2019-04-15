import * as Path from 'path';
import * as Objects from '../tools/env.objects';
import * as FS from '../tools/fs';
import * as Net from 'net';
import Logger from '../tools/env.logger';
import { guid } from '../tools/index';
import ServiceElectron from './service.electron';
import ServiceStreams, { IStreamInfo } from './service.streams';
import ServicePaths from './service.paths';
import ServiceElectronService from './service.electron.state';
import ControllerPluginProcess from '../controllers/controller.plugin.process';
import ControllerIPCPlugin from '../controllers/controller.plugin.process.ipc';
import * as npm from '../tools/npm.tools';
import { IService } from '../interfaces/interface.service';
import { IPCMessages, Subscription } from './service.electron';

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
    streams: string[];
    connections: symbol[];
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
    private _subscriptions: { [key: string ]: Subscription | undefined } = { };
    private _isRenderReady: boolean = false;
    private _seq: number = 0;
    private _ids: Map<number, string> = new Map();

    constructor() {
        this._ipc_onRenderState = this._ipc_onRenderState.bind(this);
        this._streams_onStreamAdded = this._streams_onStreamAdded.bind(this);
        this._streams_onStreamRemoved = this._streams_onStreamRemoved.bind(this);
    }

    /**
     * Initialization function
     * @returns { Promise<void> }
     */
    public init(): Promise<void> {
        return new Promise((resolve, reject) => {
            // Subscribe to render events
            this._subscribeIPCMessages();
            // Get electron version
            const version = ServiceElectron.getVersion();
            if (version instanceof Error) {
                return reject(version);
            }
            this._electronVersion = version;
            // Delivery default plugins first
            this._deliveryDefaultPlugins().then(() => {
                // Get description of all plugins
                this._getAllPluginDescription().then((plugins: Map<TPluginPath, IPlugin>) => {
                    this._plugins = plugins;
                    if (plugins.size === 0) {
                        // No plugins to be initialized
                        ServiceElectronService.logStateToRender(`No plugins installed`);
                        this._logger.env(`No plugins installed`);
                        return resolve();
                    }
                    this._initializeAllPlugins().then(() => {
                        ServiceElectronService.logStateToRender(`All plugins are ready`);
                        this._logger.error(`All plugins are ready`);
                        this._sendRenderPluginsData();
                        // Subscribe to streams events
                        this._subscribeToStreamEvents();
                        resolve();
                    }).catch((initializationError: Error) => {
                        ServiceElectronService.logStateToRender(`Error during initialization of plugins: ${initializationError.message}`);
                        this._logger.error(`Error during initialization of plugins: ${initializationError.message}`);
                        this._sendRenderPluginsData();
                        resolve();
                    });
                }).catch((readingDescriptionsError: Error) => {
                    ServiceElectronService.logStateToRender(`Fail to get description of available plugins due error: ${readingDescriptionsError.message}`);
                    this._logger.error(`Fail to get description of available plugins due error: ${readingDescriptionsError.message}`);
                    this._sendRenderPluginsData();
                    resolve();
                });
            }).catch((deliveryError: Error) => {
                ServiceElectronService.logStateToRender(`Fail to delivery default plugins due error: ${deliveryError.message}`);
                this._logger.error(`Fail to delivery default plugins due error: ${deliveryError.message}`);
                resolve();
            });
        });
    }

    public destroy(): Promise<void> {
        return new Promise((resolve) => {
            this._unsubscribeIPCMessages();
            this._unsubscribeFromStreamEvents();
            this._plugins.forEach((plugin: IPlugin) => {
                if (plugin.node === undefined) {
                    return;
                }
                plugin.node.controller.kill();
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

    public getPluginIPC(token: string): ControllerIPCPlugin | undefined {
        const plugin: IPlugin | undefined = this._getPluginInfoByToken(token);
        if (plugin === undefined) {
            return undefined;
        }
        if (plugin.node === undefined) {
            return undefined;
        }
        const IPC: ControllerIPCPlugin | Error = plugin.node.controller.getIPC();
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
        if (target.node === undefined) {
            return this._logger.error(`Fail redirect message by token ${message.token}, because plugin doesn't have process. Income message: ${message.data}`);
        }
        const ipc = target.node.controller.getIPC();
        if (ipc instanceof Error) {
            return this._logger.error(`Fail redirect message by token ${message.token} due error: ${ipc.message}`);
        }
        ipc.send(message, sequence).catch((sendingError: Error) => {
            this._logger.error(`Fail redirect message by token ${message.token} due error: ${sendingError.message}`);
        });
    }

    /* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
    *   Common
    * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
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
    *   Streams
    * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
    private _subscribeToStreamEvents() {
        ServiceStreams.on(ServiceStreams.EVENTS.streamAdded, this._streams_onStreamAdded);
        ServiceStreams.on(ServiceStreams.EVENTS.streamRemoved, this._streams_onStreamRemoved);
    }

    private _unsubscribeFromStreamEvents() {
        ServiceStreams.removeListener(ServiceStreams.EVENTS.streamAdded, this._streams_onStreamAdded);
        ServiceStreams.removeListener(ServiceStreams.EVENTS.streamRemoved, this._streams_onStreamRemoved);
    }

    private _streams_onStreamAdded(stream: IStreamInfo, transports: string[]) {
        const plugins: IPlugin[] = [];
        this._logger.env(`New stream is created ${stream.guid}. Sending information to plugins.`);
        // Get all related transports (plugins)
        transports.forEach((pluginName: string) => {
            const plugin: IPlugin | undefined = this._plugins.get(pluginName);
            if (plugin === undefined) {
                return;
            }
            plugins.push(plugin);
        });
        plugins.forEach((plugin: IPlugin) => {
            if (plugin.node === undefined) {
                this._logger.warn(`Plugin ${plugin.name} was defined as transport, but plugin doesn't have nodejs part.`);
                return;
            }
            stream.connectionFactory(plugin.name).then((connection: { socket: Net.Socket, file: string }) => {
                // Send data to plugin
                (plugin.node as any).controller.addStream(stream.guid, connection);
                // Add ref to stream
                plugin.streams.push(stream.guid);
                // Save data
                this._plugins.set(plugin.name, plugin);
            });
        });
    }

    private _streams_onStreamRemoved(streamId: string) {
        const plugins: IPlugin[] = [];
        // Find all plugins, which are bound with stream
        this._plugins.forEach((plugin: IPlugin) => {
            if (plugin.streams.indexOf(streamId) === -1) {
                return;
            }
            plugins.push(plugin);
        });
        plugins.forEach((plugin: IPlugin) => {
            if (plugin.node === undefined) {
                this._logger.warn(`Plugin ${plugin.name} was defined as transport, but plugin doesn't have nodejs part.`);
                return;
            }
            // Send data to plugin
            plugin.node.controller.removeStream(streamId);
            // Remove ref to stream
            plugin.streams.splice(plugin.streams.indexOf(streamId), 1);
            // Save data
            this._plugins.set(plugin.name, plugin);
        });
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
                // tasks.push(this._initializeProcessOfPlugin(plugin, true)); // Force reintall (debug)
            }
            if (plugin.render) {
                tasks.push(this._initializeRenderOfPlugin(plugin));
            }
            Promise.all(tasks).then(() => {
                ServiceElectronService.logStateToRender(`[${plugin.name}]: initialization of plugin is done.`);
                this._logger.env(`[${plugin.name}]: initialization of plugin is done.`);
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
    private _deliveryDefaultPlugins(): Promise<void> {
        return new Promise((resolve, reject) => {
            FS.readFolder(ServicePaths.getPlugins(), FS.EReadingFolderTarget.folders).then((plugins: string[]) => {
                if (plugins.length > 0) {
                    return resolve();
                }
                FS.readFolder(ServicePaths.getDefaultPlugins(), FS.EReadingFolderTarget.folders).then((defaultPlugins: string[]) => {
                    if (defaultPlugins.length === 0) {
                        return resolve();
                    }
                    defaultPlugins.forEach((pluginFolder: string) => {
                        FS.copyFolder(Path.resolve(ServicePaths.getDefaultPlugins(), pluginFolder), ServicePaths.getPlugins());
                    });
                    resolve();
                }).catch((defPluginsFolderReadingError: Error) => {
                    reject(defPluginsFolderReadingError);
                });
            }).catch((pluginsFolderReadingError: Error) => {
                reject(pluginsFolderReadingError);
            });
        });
    }
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
                ServiceElectronService.logStateToRender(`[${plugin.name}]: plugin is already installed.`);
                this._logger.env(`[${plugin.name}]: plugin is already installed.`);
                return resolve(false);
            } else if (FS.isExist(nodeModulesPath) && reinstall) {
                ServiceElectronService.logStateToRender(`[${plugin.name}]: force reinstalation of plugin; node_modules will be removed.`);
                this._logger.env(`[${plugin.name}]: force reinstalation of plugin; node_modules will be removed.`);
                FS.rmdir(nodeModulesPath).then(() => {
                    resolve(true);
                }).catch((error: Error) => {
                    reject(error);
                });
            } else {
                ServiceElectronService.logStateToRender(`[${plugin.name}]: plugin has to be installed.`);
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
                ServiceElectronService.logStateToRender(`[${plugin.name}]: attached.`);
                this._logger.env(`[${plugin.name}]: attached.`);
                resolve(process);
            }).catch((attachError: Error) => {
                ServiceElectronService.logStateToRender(`[${plugin.name}]: fail to attach due error: ${attachError.message}`);
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
                        plugin.verified.process = true;
                        this._plugins.set(plugin.name, plugin);
                        resolve();
                    }).catch((attachError: Error) => {
                        reject(attachError);
                    });
                };

                if (install) {
                    ServiceElectronService.logStateToRender(`[${plugin.name}]: installing`);
                    this._logger.env(`[${plugin.name}]: installing`);
                    npm.install(plugin.path.process).then(() => {
                        ServiceElectronService.logStateToRender(`[${plugin.name}]: installation is complited.`);
                        ServiceElectronService.logStateToRender(`[${plugin.name}]: rebuild.`);
                        this._logger.env(`[${plugin.name}]: installation is complited.`);
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
            if (typeof plugin.packages.render.main !== 'string' || plugin.packages.render.main.trim() === '') {
                ServiceElectronService.logStateToRender(`[${plugin.name}]: Fail to find field "main" in package.json of plugin.`);
                return reject(new Error(this._logger.error(`[${plugin.name}]: Fail to find field "main" in package.json of plugin.`)));
            }
            // Check main file of plugin
            const main: string = Path.normalize(Path.resolve(plugin.path.render, plugin.packages.render.main));
            if (!FS.isExist(main)) {
                ServiceElectronService.logStateToRender(`[${plugin.name}]: Fail to find main file: "${plugin.packages.render.main}" / "${main}"`);
                return reject(new Error(this._logger.error(`[${plugin.name}]: Fail to find main file: "${plugin.packages.render.main}" / "${main}"`)));
            }
            // Mark plugin as verified
            plugin.verified.render = true;
            // Save location
            plugin.info.renderLocation = main;
            // Update plugin info
            this._plugins.set(plugin.name, plugin);
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
                    ServiceElectronService.logStateToRender(`No any plugins were found. Target folder: ${this._path}`);
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
                        ServiceElectronService.logStateToRender(`Not all plugins were initialized due next errors: \n\t-\t${errors.map((e: Error) => e.message).join('\n\t-\t')}`);
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
                    ServiceElectronService.logStateToRender(`Unexpected error during initialization of plugin: ${error.message}`);
                    this._logger.error(`Unexpected error during initialization of plugin: ${error.message}`);
                    resolve(plugins);
                });
            }).catch((error: Error) => {
                ServiceElectronService.logStateToRender(`Fail to read plugins folder (${this._path}) due error: ${error.message}. Application will continue work, but plugins weren't inited.`);
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
                streams: [],
                connections: [],
            };
            this._ids.set(desc.id, desc.token);
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
                ServiceElectronService.logStateToRender(`Package.json file "${packageFile}" doesn't exist`);
                return reject(new Error(this._logger.error(`Package.json file "${packageFile}" doesn't exist`)));
            }
            FS.readTextFile(packageFile).then((content: string) => {
                const json = Objects.getJSON(content);
                if (json instanceof Error) {
                    ServiceElectronService.logStateToRender(`Cannot parse package file "${packageFile}" due error: ${json.message}`);
                    return reject(new Error(this._logger.error(`Cannot parse package file "${packageFile}" due error: ${json.message}`)));
                }
                resolve(json);
            }).catch((error: Error) => {
                ServiceElectronService.logStateToRender(`Fail to read package at "${packageFile}" due error: ${error.message}`);
                this._logger.error(`Fail to read package at "${packageFile}" due error: ${error.message}`);
            });
        });
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

    private _unsubscribeIPCMessages() {
        Object.keys(this._subscriptions).forEach((key: string) => {
            (this._subscriptions as any)[key].destroy();
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
            this._logger.env(`Information about plugin "${names}" was sent to render`);
        }).catch((sendingError: Error) => {
            ServiceElectronService.logStateToRender(`Fail to send information to render about plugin "${names}" due error: ${sendingError.message}`);
            this._logger.error(`Fail to send information to render about plugin "${names}" due error: ${sendingError.message}`);
        });
    }

}

export default (new ServicePlugins());
