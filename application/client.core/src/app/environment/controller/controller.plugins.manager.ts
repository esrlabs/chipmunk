import * as Toolkit from 'chipmunk.client.toolkit';

import { Subscription, Subject, Observable  } from 'rxjs';
import { CommonInterfaces } from '../interfaces/interface.common';
import { IPCMessages } from '../services/service.electron.ipc';

import ElectronIpcService from '../services/service.electron.ipc';

export interface IPlugin extends CommonInterfaces.Plugins.IPlugin {
    installed: boolean;
}

export enum EManagerState {
    pending = 'pending',
    ready = 'ready',
}

export default class ControllerPluginsManager {

    private _plugins: IPlugin[] = [];
    private _logger: Toolkit.Logger = new Toolkit.Logger('ControllerPluginsManager');
    private _subscriptions: { [key: string ]: Toolkit.Subscription } = { };
    private _subjects: {
        ready: Subject<void>,
    } = {
        ready: new Subject<void>(),
    };
    private _state: EManagerState = EManagerState.pending;

    constructor() {
        this._subscriptions.PluginsDataReady = ElectronIpcService.subscribe(IPCMessages.PluginsDataReady, this._ipc_PluginsDataReady.bind(this));
    }

    public destroy() {
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].destroy();
        });
    }

    public getObservable(): {
        ready: Observable<void>
    } {
        return {
            ready: this._subjects.ready.asObservable(),
        };
    }

    public getState(): EManagerState {
        return this._state;
    }

    public getPlugins(): IPlugin[] {
        return this._plugins.slice();
    }

    public install(name: string): Promise<void> {
        return new Promise((resolve, reject) => {
            ElectronIpcService.request(new IPCMessages.PluginsInstallRequest({
                name: name
            }), IPCMessages.PluginsInstallResponse).then((response: IPCMessages.PluginsInstallResponse) => {
                if (typeof response.error === 'string') {
                    this._logger.error(`Fail to download plugin due error: ${response.error}`);
                    reject(new Error(response.error));
                } else {
                    resolve();
                }
            }).catch((error: Error) => {
                this._logger.error(`Fail to request downloading of plugin due error: ${error.message}`);
                reject(error);
            });
        });
    }

    public uninstall(name: string): Promise<void> {
        return new Promise((resolve, reject) => {
            ElectronIpcService.request(new IPCMessages.PluginsUninstallRequest({
                name: name
            }), IPCMessages.PluginsUninstallResponse).then((response: IPCMessages.PluginsUninstallResponse) => {
                if (typeof response.error === 'string') {
                    this._logger.error(`Fail to uninstall plugin due error: ${response.error}`);
                    reject(new Error(response.error));
                } else {
                    resolve();
                }
            }).catch((error: Error) => {
                this._logger.error(`Fail to request uninstall of plugin due error: ${error.message}`);
                reject(error);
            });
        });
    }

    public restart(): Promise<void> {
        return new Promise((resolve, reject) => {
            ElectronIpcService.request(new IPCMessages.AppRestartRequest(), IPCMessages.AppRestartResponse).then((response: IPCMessages.AppRestartResponse) => {
                if (typeof response.error === 'string') {
                    this._logger.error(`Fail to restart due error: ${response.error}`);
                    return reject(new Error(response.error));
                }
                resolve();
            }).catch((error: Error) => {
                this._logger.error(`Fail to restart due error: ${error.message}`);
                reject(error);
            });
        });
    }

    private _getInstalledPluginsInfo(): Promise<CommonInterfaces.Plugins.IPlugin[]> {
        return new Promise((resolve, reject) => {
            ElectronIpcService.request(new IPCMessages.PluginsInstalledRequest(), IPCMessages.PluginsInstalledResponse).then((message: IPCMessages.PluginsInstalledResponse) => {
                resolve(message.plugins instanceof Array ? message.plugins : []);
            }).catch((error: Error) => {
                this._logger.warn(`Fail request list of installed plugins due error: ${error.message}`);
                reject(error);
            });
        });
    }

    private _getAvailablePluginsInfo(): Promise<CommonInterfaces.Plugins.IPlugin[]> {
        return new Promise((resolve, reject) => {
            ElectronIpcService.request(new IPCMessages.PluginsStoreAvailableRequest(), IPCMessages.PluginsStoreAvailableResponse).then((message: IPCMessages.PluginsStoreAvailableResponse) => {
                resolve(message.plugins instanceof Array ? message.plugins : []);
            }).catch((error: Error) => {
                this._logger.warn(`Fail request list of installed plugins due error: ${error.message}`);
                reject(error);
            });
        });
    }

    private _ipc_PluginsDataReady() {
        this._getPlugins().then((plugins: IPlugin[]) => {
            this._plugins = plugins;
            this._state = EManagerState.ready;
            this._subjects.ready.next();
        }).catch((error: Error) => {
            this._logger.error(`Fail to request plugins data due error: ${error.message}`);
            this._plugins = [];
        });
    }

    private _getPlugins(): Promise<IPlugin[]> {
        return new Promise((resolve) => {
            Promise.all([
                this._getInstalledPluginsInfo().catch((error: Error) => {
                    this._logger.warn(`Fail get list of installed plugins due error: ${error.message}`);
                    return Promise.resolve([]);
                }),
                this._getAvailablePluginsInfo().catch((error: Error) => {
                    this._logger.warn(`Fail get list of available plugins due error: ${error.message}`);
                    return Promise.resolve([]);
                }),
            ]).then((results: Array<CommonInterfaces.Plugins.IPlugin[]>) => {
                const installed: CommonInterfaces.Plugins.IPlugin[] = results[0];
                const available: CommonInterfaces.Plugins.IPlugin[] = results[1];
                const plugins: IPlugin[] = available.map((p: CommonInterfaces.Plugins.IPlugin) => {
                    (p as IPlugin).installed = false;
                    installed.forEach((plugin: CommonInterfaces.Plugins.IPlugin) => {
                        if (p.name === plugin.name) {
                            p = plugin;
                            (p as IPlugin).installed = true;
                        }
                    });
                    return p as IPlugin;
                });
                plugins.sort((a) => {
                    return a.installed ? -1 : 1;
                });
                resolve(plugins);
            }).catch((error: Error) => {
                this._logger.error(`Fail to fetch plugins data due error: ${error.message}`);
                resolve([]);
            });
        });
    }
}
