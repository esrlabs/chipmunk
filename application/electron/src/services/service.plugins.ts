import Logger from '../tools/env.logger';
import ServiceElectron from './service.electron';
import ServiceElectronService from './service.electron.state';
import ServiceRenderState from './service.render.state';
import ControllerIPCPlugin from '../controllers/plugins/plugin.process.ipc';
import ControllerPluginStore from '../controllers/plugins/plugins.store';
import ControllerPluginStorage, { InstalledPlugin } from '../controllers/plugins/plugins.storage';
import ControllerPluginsManager from '../controllers/plugins/plugins.manager';

import { ControllerSession } from '../controllers/stream.main/controller';
import { IService } from '../interfaces/interface.service';
import { IPCMessages, Subscription } from './service.electron';
import { IApplication } from '../interfaces/interface.app';

/**
 * @class ServicePluginNode
 * @description Looking for plugins, which should be attached on nodejs level
 */
export class ServicePlugins implements IService {

    private _logger: Logger = new Logger('ServicePluginNode');
    private _subscriptions: { [key: string ]: Subscription } = { };
    private _storage: ControllerPluginStorage;
    private _store: ControllerPluginStore;
    private _manager: ControllerPluginsManager;
    private _app: IApplication | undefined;

    constructor() {
        this._store = new ControllerPluginStore();
        this._storage = new ControllerPluginStorage();
        this._manager = new ControllerPluginsManager(this._store, this._storage);
    }
    /**
     * Initialization function
     * @returns { Promise<void> }
     */
    public init(app: IApplication): Promise<void> {
        return new Promise((resolve, reject) => {
            this._manager.init().then(() => {
                // Read store information
                this._store.local().then(() => {
                    this._logger.debug(`Plugins store data is load`);
                }).catch((storeErr: Error) => {
                    this._logger.warn(`Fail load plugins store data due error: ${storeErr.message}`);
                }).finally(() => {
                    // Read local plugins and initialize it
                    this._manager.load().then(() => {
                        this._logger.debug(`Installed plugins are initialized`);
                        // Load defaults plugins
                        this._manager.defaults().then(() => {
                            this._logger.debug(`Defaults plugins are checked`);
                        }).catch((defErr: Error) => {
                            this._logger.warn(`Fail to check default plugins due error: ${defErr.message}`);
                        }).finally(() => {
                            this._storage.logState();
                            // Start single process plugins
                            this._storage.runAllSingleProcess().catch((singleProcessRunErr: Error) => {
                                this._logger.warn(`Fail to start single process plugins due error: ${singleProcessRunErr.message}`);
                            });
                            ServiceRenderState.doOnInit('ServicePlugins: SendRenderPluginsData', this._sendRenderPluginsData.bind(this));
                            resolve();
                        });
                    }).catch((loadErr: Error) => {
                        this._logger.warn(`Fail load installed plugins due error: ${loadErr.message}`);
                        resolve();
                    });
                });
            }).catch((mngErr: Error) => {
                this._logger.warn(`Fail to init plugin's manager due error: ${mngErr.message}`);
                resolve();
            });
        });
    }

    public destroy(): Promise<void> {
        return new Promise((resolve) => {
            Object.keys(this._subscriptions).forEach((key: string) => {
                (this._subscriptions as any)[key].destroy();
            });
            Promise.all([
                this._manager.destroy().catch((err: Error) => {
                    this._logger.warn(`Fail to correctly destroy controller "ControllerPluginsManager" due error: ${err.message}`);
                }),
                this._store.destroy().catch((err: Error) => {
                    this._logger.warn(`Fail to correctly destroy controller "ControllerPluginStore" due error: ${err.message}`);
                }),
                this._storage.destroy().catch((err: Error) => {
                    this._logger.warn(`Fail to correctly destroy controller "ControllerPluginStorage" due error: ${err.message}`);
                }),
            ]).catch((error: Error) => {
                this._logger.warn(`Error during destroy plugin's process: ${error.message}`);
            }).finally(() => {
                resolve();
            });
        });
    }

    public shutdown(): Promise<void> {
        return new Promise((resolve) => {
            this._storage.shutdown().catch((error: Error) => {
                this._logger.warn(`Error during shutdown plugin's process: ${error.message}`);
            }).finally(() => {
                resolve();
            });
        });
    }

    public getName(): string {
        return 'ServicePlugins';
    }

    public getPluginToken(id: number): string | undefined {
        const plugin: InstalledPlugin | undefined = this._storage.getPluginById(id);
        return plugin === undefined ? undefined : plugin.getToken();
    }

    public getPluginName(id: number): string | undefined {
        const plugin: InstalledPlugin | undefined = this._storage.getPluginById(id);
        return plugin === undefined ? undefined : plugin.getName();
    }

    public getPluginIPC(session: string, token: string): ControllerIPCPlugin | undefined {
        const plugin: InstalledPlugin | undefined = this._storage.getPluginByToken(token);
        if (plugin === undefined) {
            return undefined;
        }
        return plugin.getSessionIPC(session);
    }

    public redirectIPCMessageToPluginHost(message: IPCMessages.PluginInternalMessage, sequence?: string) {
        const ipc: ControllerIPCPlugin | undefined = this.getPluginIPC(message.stream, message.token);
        if (ipc === undefined) {
            return this._logger.error(`Fail redirect message for plugin (token: ${message.token}), becase fail to get plugin's IPC`);
        }
        ipc.send(message, sequence).catch((sendingError: Error) => {
            this._logger.error(`Fail redirect message by token ${message.token} due error: ${sendingError.message}`);
        });
    }

    public addStream(session: ControllerSession): Promise<void> {
        return this._storage.bindWithSession(session);
    }

    public removedStream(session: string): Promise<void> {
        return this._storage.unbindWithSession(session);
    }

    public getSessionPluginsNames(): string[] {
        return this._storage.getNamesOfInstalled();
    }

    public revision(): void {
        this._manager.revision();
    }

    public accomplish(): Promise<void> {
        return this._manager.accomplish().catch((error: Error) => {
            this._logger.warn(`Accomplish operation was done with error: ${error.message}`);
        });
    }

    private _sendRenderPluginsData() {
        const plugins: IPCMessages.IRenderMountPluginInfo[] = this._storage.getPluginRendersInfo();
        const names: string = plugins.map((info: IPCMessages.IRenderMountPluginInfo) => {
            return info.name;
        }).join(', ');
        // Inform render about plugin location
        ServiceElectron.IPC.send(new IPCMessages.RenderMountPlugin({
            plugins: plugins,
        })).then(() => {
            this._logger.debug(`Information about plugin "${names}" was sent to render`);
        }).catch((sendingError: Error) => {
            ServiceElectronService.logStateToRender(`Fail to send information to render about plugin "${names}" due error: ${sendingError.message}`);
            this._logger.error(`Fail to send information to render about plugin "${names}" due error: ${sendingError.message}`);
        });
    }

}

export default (new ServicePlugins());
