import * as Toolkit from 'chipmunk.client.toolkit';

import { Subject, Observable } from 'rxjs';
import { CommonInterfaces } from '../interfaces/interface.common';
import { IPC } from '../services/service.electron.ipc';
import { Queue } from '../controller/helpers/queue';
import { Storage } from '../controller/helpers/virtualstorage';

import ElectronIpcService from '../services/service.electron.ipc';
import CustomTabsEventsService from '../services/standalone/service.customtabs.events';

export enum EPluginState {
    installed = 'installed',
    update = 'update',
    upgrade = 'upgrade',
    notinstalled = 'notinstalled',
    notavailable = 'notavailable',
    incompatible = 'incompatible',
    working = 'working',
    restart = 'restart',
    error = 'error',
}

export enum EUpdateState {
    pending = 'pending',
    working = 'working',
    restart = 'restart',
    error = 'error',
}

export interface IPlugin extends CommonInterfaces.Plugins.IPlugin {
    installed: boolean;
    state: EPluginState;
    update: string[];
    upgrade: string[];
}

export enum EManagerState {
    pending = 'pending',
    ready = 'ready',
}

export interface IUpdateUpgradeEvent {
    name: string;
    versions: string[];
}

export interface IStateChangeEvent {
    name: string;
    state: EPluginState;
}

export interface IViewState {
    selected: string | undefined;
    width: number;
}

export default class ControllerPluginsManager {
    private _plugins: Map<string, IPlugin> = new Map();
    private _logger: Toolkit.Logger = new Toolkit.Logger('ControllerPluginsManager');
    private _subscriptions: { [key: string]: Toolkit.Subscription } = {};
    private _subjects: {
        ready: Subject<void>;
        update: Subject<IUpdateUpgradeEvent>;
        upgrade: Subject<IUpdateUpgradeEvent>;
        state: Subject<IStateChangeEvent>;
        updater: Subject<EUpdateState>;
        custom: Subject<EUpdateState>;
    } = {
        ready: new Subject<void>(),
        update: new Subject<IUpdateUpgradeEvent>(),
        upgrade: new Subject<IUpdateUpgradeEvent>(),
        state: new Subject<IStateChangeEvent>(),
        updater: new Subject<EUpdateState>(),
        custom: new Subject<EUpdateState>(),
    };
    private _states: {
        manager: EManagerState;
        updater: EUpdateState;
        custom: EUpdateState;
    } = {
        manager: EManagerState.pending,
        updater: EUpdateState.pending,
        custom: EUpdateState.pending,
    };
    private _queue: Queue = new Queue();
    private _storage: Storage<IViewState> = new Storage<IViewState>({
        selected: undefined,
        width: 0.5,
    });

    constructor() {
        this._subscriptions.PluginsDataReady = ElectronIpcService.subscribe(
            IPC.PluginsDataReady,
            this._ipc_PluginsDataReady.bind(this),
        );
        this._subscriptions.PluginsNotificationUpdate = ElectronIpcService.subscribe(
            IPC.PluginsNotificationUpdate,
            this._ipc_PluginsNotificationUpdate.bind(this),
        );
        this._subscriptions.PluginsNotificationUpgrade = ElectronIpcService.subscribe(
            IPC.PluginsNotificationUpgrade,
            this._ipc_PluginsNotificationUpgrade.bind(this),
        );
    }

    public destroy() {
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].destroy();
        });
    }

    public getObservable(): {
        ready: Observable<void>;
        update: Observable<IUpdateUpgradeEvent>;
        upgrade: Observable<IUpdateUpgradeEvent>;
        state: Observable<IStateChangeEvent>;
        updater: Observable<EUpdateState>;
        custom: Observable<EUpdateState>;
    } {
        return {
            ready: this._subjects.ready.asObservable(),
            update: this._subjects.update.asObservable(),
            upgrade: this._subjects.upgrade.asObservable(),
            state: this._subjects.state.asObservable(),
            updater: this._subjects.updater.asObservable(),
            custom: this._subjects.custom.asObservable(),
        };
    }

    public getManagerState(): EManagerState {
        return this._states.manager;
    }

    public getUpdateState(): EUpdateState {
        return this._states.updater;
    }

    public getCustomState(): EUpdateState {
        return this._states.custom;
    }

    public getByName(name: string): IPlugin | undefined {
        return this._plugins.get(name);
    }

    public getPlugins(): IPlugin[] {
        const plugins: IPlugin[] = Array.from(this._plugins.values()).map((plugin: IPlugin) => {
            return Object.assign({}, plugin);
        });
        plugins.sort((a) => {
            return a.installed ? -1 : 1;
        });
        return plugins;
    }

    public install(name: string, version: string): Promise<void> {
        return new Promise((resolve, reject) => {
            this.setPluginState(name, EPluginState.working);
            ElectronIpcService.request(
                new IPC.PluginsInstallRequest({
                    name: name,
                    version: version,
                }),
                IPC.PluginsInstallResponse,
            )
                .then((response: IPC.PluginsInstallResponse) => {
                    if (typeof response.error === 'string') {
                        this._logger.error(`Fail to install plugin due error: ${response.error}`);
                        this.setPluginState(name, EPluginState.error);
                        reject(new Error(response.error));
                    } else {
                        this.setPluginState(name, EPluginState.restart);
                        resolve();
                    }
                })
                .catch((error: Error) => {
                    this._logger.error(
                        `Fail to request install of plugin due error: ${error.message}`,
                    );
                    this.setPluginState(name, EPluginState.error);
                    reject(error);
                });
        });
    }

    public updateAndUpgradeAll(): Promise<void> {
        return new Promise((resolve, reject) => {
            this.setUpdaterState(EUpdateState.working);
            Promise.all(
                Array.from(this._plugins.values())
                    .filter((plugin: IPlugin) => {
                        return (
                            (plugin.state === EPluginState.update && plugin.update.length > 0) ||
                            (plugin.state === EPluginState.upgrade && plugin.upgrade.length > 0)
                        );
                    })
                    .map((plugin: IPlugin) => {
                        switch (plugin.state) {
                            case EPluginState.update:
                                return this.update(plugin.name, plugin.update[0]);
                            case EPluginState.upgrade:
                                return this.upgrade(plugin.name, plugin.upgrade[0]);
                            default:
                                return Promise.reject(
                                    new Error(
                                        this._logger.error(
                                            `Unexpected type of plugin (${plugin.state}) for plugin: ${plugin.name}`,
                                        ),
                                    ),
                                );
                        }
                    }),
            )
                .then(() => {
                    this.setUpdaterState(EUpdateState.restart);
                    resolve();
                })
                .catch((error: Error) => {
                    this._logger.warn(`Fail to update and upgrade all due error: ${error.message}`);
                    this.setUpdaterState(EUpdateState.error);
                    reject(error);
                });
        });
    }

    public update(name: string, version: string): Promise<void> {
        return new Promise((resolve, reject) => {
            this.setPluginState(name, EPluginState.working);
            ElectronIpcService.request(
                new IPC.PluginsUpdateRequest({
                    name: name,
                    version: version,
                }),
                IPC.PluginsUpdateResponse,
            )
                .then((response: IPC.PluginsUpdateResponse) => {
                    if (typeof response.error === 'string') {
                        this._logger.error(`Fail to update plugin due error: ${response.error}`);
                        this.setPluginState(name, EPluginState.error);
                        reject(new Error(response.error));
                    } else {
                        this.setPluginState(name, EPluginState.restart);
                        resolve();
                    }
                })
                .catch((error: Error) => {
                    this._logger.error(
                        `Fail to request update of plugin due error: ${error.message}`,
                    );
                    this.setPluginState(name, EPluginState.error);
                    reject(error);
                });
        });
    }

    public upgrade(name: string, version: string): Promise<void> {
        return new Promise((resolve, reject) => {
            this.setPluginState(name, EPluginState.working);
            ElectronIpcService.request(
                new IPC.PluginsUpgradeRequest({
                    name: name,
                    version: version,
                }),
                IPC.PluginsUpgradeResponse,
            )
                .then((response: IPC.PluginsUpgradeResponse) => {
                    if (typeof response.error === 'string') {
                        this._logger.error(`Fail to upgrade plugin due error: ${response.error}`);
                        this.setPluginState(name, EPluginState.error);
                        reject(new Error(response.error));
                    } else {
                        this.setPluginState(name, EPluginState.restart);
                        resolve();
                    }
                })
                .catch((error: Error) => {
                    this._logger.error(
                        `Fail to request upgrade of plugin due error: ${error.message}`,
                    );
                    this.setPluginState(name, EPluginState.error);
                    reject(error);
                });
        });
    }

    public uninstall(name: string): Promise<void> {
        return new Promise((resolve, reject) => {
            this.setPluginState(name, EPluginState.working);
            ElectronIpcService.request(
                new IPC.PluginsUninstallRequest({
                    name: name,
                }),
                IPC.PluginsUninstallResponse,
            )
                .then((response: IPC.PluginsUninstallResponse) => {
                    if (typeof response.error === 'string') {
                        this._logger.error(`Fail to uninstall plugin due error: ${response.error}`);
                        this.setPluginState(name, EPluginState.error);
                        reject(new Error(response.error));
                    } else {
                        this.setPluginState(name, EPluginState.restart);
                        resolve();
                    }
                })
                .catch((error: Error) => {
                    this._logger.error(
                        `Fail to request uninstall of plugin due error: ${error.message}`,
                    );
                    this.setPluginState(name, EPluginState.error);
                    reject(error);
                });
        });
    }

    public custom(): Promise<string | undefined> {
        return new Promise((resolve, reject) => {
            this.setCustomState(EUpdateState.working);
            ElectronIpcService.request(new IPC.PluginAddRequest(), IPC.PluginAddResponse)
                .then((response: IPC.PluginAddResponse) => {
                    if (typeof response.error === 'string') {
                        this._logger.error(
                            `Fail to install custom plugin due error: ${response.error}`,
                        );
                        this.setCustomState(EUpdateState.error);
                        reject(new Error(response.error));
                    } else {
                        if (typeof response.name === 'string' && response.name.trim() !== '') {
                            this.setCustomState(EUpdateState.restart);
                        } else {
                            this.setCustomState(EUpdateState.pending);
                        }
                        resolve(response.name);
                    }
                })
                .catch((error: Error) => {
                    this._logger.error(
                        `Fail to request installation of custom plugin due error: ${error.message}`,
                    );
                    this.setCustomState(EUpdateState.error);
                    reject(error);
                });
        });
    }

    public getLogs(name: string): Promise<string[]> {
        return new Promise((resolve, reject) => {
            ElectronIpcService.request<IPC.PluginsLogsResponse>(
                new IPC.PluginsLogsRequest({
                    name: name,
                }),
                IPC.PluginsLogsResponse,
            )
                .then((response) => {
                    if (typeof response.error === 'string') {
                        this._logger.error(
                            `Fail to get plugin's logs due error: ${response.error}`,
                        );
                        return reject(new Error(response.error));
                    }
                    if (response.logs.trim() === '') {
                        resolve([]);
                    } else {
                        resolve(response.logs.split(/[\n\r]/gi));
                    }
                })
                .catch((error: Error) => {
                    this._logger.error(
                        `Fail to request logs of plugin due error: ${error.message}`,
                    );
                    reject(error);
                });
        });
    }

    public restart(): Promise<void> {
        return new Promise((resolve, reject) => {
            ElectronIpcService.request(new IPC.AppRestartRequest(), IPC.AppRestartResponse)
                .then((response: IPC.AppRestartResponse) => {
                    if (typeof response.error === 'string') {
                        this._logger.error(`Fail to restart due error: ${response.error}`);
                        return reject(new Error(response.error));
                    }
                    resolve();
                })
                .catch((error: Error) => {
                    this._logger.error(`Fail to restart due error: ${error.message}`);
                    reject(error);
                });
        });
    }

    public getVersionsToBeUpdated(name: string): string[] | undefined {
        const plugin: IPlugin | undefined = this._plugins.get(name);
        if (plugin === undefined) {
            return undefined;
        }
        return plugin.update.length === 0 ? undefined : [];
    }

    public getVersionsToBeUpgraded(name: string): string[] | undefined {
        const plugin: IPlugin | undefined = this._plugins.get(name);
        if (plugin === undefined) {
            return undefined;
        }
        return plugin.upgrade.length === 0 ? undefined : [];
    }

    public getCountToBeUpdated(): number {
        let updates: number = 0;
        this._plugins.forEach((plugin: IPlugin) => {
            updates += plugin.update.length > 0 ? 1 : 0;
        });
        return updates;
    }

    public getCountToBeUpgraded(): number {
        let upgrades: number = 0;
        this._plugins.forEach((plugin: IPlugin) => {
            upgrades += plugin.upgrade.length > 0 ? 1 : 0;
        });
        return upgrades;
    }

    public getCountToBeUpgradedUpdated(): number {
        let count: number = 0;
        this._plugins.forEach((plugin: IPlugin) => {
            if (plugin.update.length > 0 || plugin.upgrade.length > 0) {
                count += 1;
            }
        });
        return count;
    }

    public setPluginState(name: string, state: EPluginState) {
        const plugin: IPlugin | undefined = this._plugins.get(name);
        if (plugin === undefined) {
            return;
        }
        plugin.state = state;
        this._subjects.state.next({ name: name, state: state });
    }

    public setUpdaterState(state: EUpdateState) {
        this._states.updater = state;
        this._subjects.updater.next(state);
    }

    public setCustomState(state: EUpdateState) {
        this._states.custom = state;
        this._subjects.custom.next(state);
    }

    public getStorage(): Storage<IViewState> {
        return this._storage;
    }

    private _getInstalledPluginsInfo(): Promise<CommonInterfaces.Plugins.IPlugin[]> {
        return new Promise((resolve, reject) => {
            ElectronIpcService.request<IPC.PluginsInstalledResponse>(
                new IPC.PluginsInstalledRequest(),
                IPC.PluginsInstalledResponse,
            )
                .then((message) => {
                    resolve(message.plugins instanceof Array ? message.plugins : []);
                })
                .catch((error: Error) => {
                    this._logger.warn(
                        `Fail request list of installed plugins due error: ${error.message}`,
                    );
                    reject(error);
                });
        });
    }

    private _getIncompatiblesPluginsInfo(): Promise<CommonInterfaces.Plugins.IPlugin[]> {
        return new Promise((resolve, reject) => {
            ElectronIpcService.request<IPC.PluginsIncompatiblesResponse>(
                new IPC.PluginsIncompatiblesRequest(),
                IPC.PluginsIncompatiblesResponse,
            )
                .then((message) => {
                    resolve(message.plugins instanceof Array ? message.plugins : []);
                })
                .catch((error: Error) => {
                    this._logger.warn(
                        `Fail request list of incompatible plugins due error: ${error.message}`,
                    );
                    reject(error);
                });
        });
    }

    private _getAvailablePluginsInfo(): Promise<CommonInterfaces.Plugins.IPlugin[]> {
        return new Promise((resolve, reject) => {
            ElectronIpcService.request<IPC.PluginsStoreAvailableResponse>(
                new IPC.PluginsStoreAvailableRequest(),
                IPC.PluginsStoreAvailableResponse,
            )
                .then((message) => {
                    resolve(message.plugins instanceof Array ? message.plugins : []);
                })
                .catch((error: Error) => {
                    this._logger.warn(
                        `Fail request list of installed plugins due error: ${error.message}`,
                    );
                    reject(error);
                });
        });
    }

    private _ipc_PluginsDataReady() {
        this._getPlugins()
            .then((plugins: Map<string, IPlugin>) => {
                this._plugins = plugins;
                this._states.manager = EManagerState.ready;
                this._subjects.ready.next();
                this._queue.unlock();
                if (this.getCountToBeUpgradedUpdated() > 0) {
                    CustomTabsEventsService.emit().plugins();
                }
            })
            .catch((error: Error) => {
                this._logger.error(`Fail to request plugins data due error: ${error.message}`);
                this._plugins = new Map();
            });
    }

    private _ipc_PluginsNotificationUpdate(msg: IPC.PluginsNotificationUpdate) {
        this._queue.do(() => {
            const plugin: IPlugin | undefined = this._plugins.get(msg.name);
            if (plugin === undefined) {
                this._logger.warn(`Cannot find a plugin "${msg.name}"`);
                return;
            }
            if (plugin.update.length > 0) {
                this._logger.warn(
                    `Plugin "${plugin.name}" has beed already informed about updates`,
                );
                return;
            }
            const versions: string[] = msg.versions.map(
                (r: CommonInterfaces.Plugins.IHistory) => r.version,
            );
            if (versions.length === 0) {
                this._logger.warn(
                    `Have gotten message about update plugin "${plugin.name}", but no versions list.`,
                );
                return;
            }
            plugin.update = versions;
            this._subjects.update.next({ name: plugin.name, versions: versions });
            this.setPluginState(plugin.name, EPluginState.update);
        });
    }

    private _ipc_PluginsNotificationUpgrade(msg: IPC.PluginsNotificationUpgrade) {
        this._queue.do(() => {
            const plugin: IPlugin | undefined = this._plugins.get(msg.name);
            if (plugin === undefined) {
                this._logger.warn(`Cannot find a plugin "${msg.name}"`);
                return;
            }
            if (plugin.upgrade.length > 0) {
                this._logger.warn(
                    `Plugin "${plugin.name}" has beed already informed about upgrade`,
                );
                return;
            }
            const versions: string[] = msg.versions.map(
                (r: CommonInterfaces.Plugins.IHistory) => r.version,
            );
            if (versions.length === 0) {
                this._logger.warn(
                    `Have gotten message about upgrade plugin "${plugin.name}", but no versions list.`,
                );
                return;
            }
            plugin.upgrade = versions;
            this._subjects.upgrade.next({ name: plugin.name, versions: versions });
            this.setPluginState(plugin.name, EPluginState.upgrade);
        });
    }

    private _getPlugins(): Promise<Map<string, IPlugin>> {
        return new Promise((resolve) => {
            Promise.all([
                this._getInstalledPluginsInfo().catch((error: Error) => {
                    this._logger.warn(
                        `Fail get list of installed plugins due error: ${error.message}`,
                    );
                    return Promise.resolve([]);
                }),
                this._getAvailablePluginsInfo().catch((error: Error) => {
                    this._logger.warn(
                        `Fail get list of available plugins due error: ${error.message}`,
                    );
                    return Promise.resolve([]);
                }),
                this._getIncompatiblesPluginsInfo().catch((error: Error) => {
                    this._logger.warn(
                        `Fail get list of incompatible plugins due error: ${error.message}`,
                    );
                    return Promise.resolve([]);
                }),
            ])
                .then((results: Array<CommonInterfaces.Plugins.IPlugin[]>) => {
                    const installed: CommonInterfaces.Plugins.IPlugin[] = results[0];
                    const available: CommonInterfaces.Plugins.IPlugin[] = results[1];
                    const incompatible: CommonInterfaces.Plugins.IPlugin[] = results[2];
                    const plugins: Map<string, IPlugin> = new Map();
                    available.forEach((p: CommonInterfaces.Plugins.IPlugin) => {
                        (p as IPlugin).installed = false;
                        installed.forEach((plugin: CommonInterfaces.Plugins.IPlugin) => {
                            if (p.name === plugin.name) {
                                p = plugin;
                                (p as IPlugin).installed = true;
                            }
                        });
                        p = this._setDefaults(p);
                        plugins.set(p.name, p as IPlugin);
                    });
                    installed.forEach((p: CommonInterfaces.Plugins.IPlugin) => {
                        if (plugins.has(p.name)) {
                            return;
                        }
                        (p as IPlugin).installed = true;
                        p = this._setDefaults(p);
                        plugins.set(p.name, p as IPlugin);
                    });
                    incompatible.forEach((p: CommonInterfaces.Plugins.IPlugin) => {
                        if (plugins.has(p.name)) {
                            return;
                        }
                        p = this._setDefaults(p, EPluginState.incompatible);
                        plugins.set(p.name, p as IPlugin);
                    });
                    resolve(plugins);
                })
                .catch((error: Error) => {
                    this._logger.error(`Fail to fetch plugins data due error: ${error.message}`);
                    resolve(new Map());
                });
        });
    }

    private _setDefaults(p: CommonInterfaces.Plugins.IPlugin, state?: EPluginState): IPlugin {
        (p as IPlugin).update = [];
        (p as IPlugin).upgrade = [];
        if (state !== undefined) {
            (p as IPlugin).state = state;
        } else if ((p as IPlugin).installed) {
            (p as IPlugin).state = EPluginState.installed;
        } else if (p.suitable instanceof Array && p.suitable.length > 0) {
            if (this.getVersionsToBeUpdated(p.name) !== undefined) {
                (p as IPlugin).state = EPluginState.update;
            } else if (this.getVersionsToBeUpgraded(p.name) !== undefined) {
                (p as IPlugin).state = EPluginState.upgrade;
            } else {
                (p as IPlugin).state = EPluginState.notinstalled;
            }
        } else if (!(p.suitable instanceof Array) || p.suitable.length === 0) {
            (p as IPlugin).state = EPluginState.notavailable;
        }
        return p as IPlugin;
    }
}
