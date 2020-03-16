import Logger from '../tools/env.logger';
import ServiceElectron from './service.electron';
import ServiceElectronService from './service.electron.state';
import ServiceRenderState from './service.render.state';
import ControllerIPCPlugin from '../controllers/plugins/plugin.process.ipc';
import ControllerPluginStore from '../controllers/plugins/plugins.store';
import ControllerPluginStorage, { InstalledPlugin, TConnectionFactory } from '../controllers/plugins/plugins.storage';

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
    private _app: IApplication | undefined;

    constructor() {
        this._store = new ControllerPluginStore();
        this._storage = new ControllerPluginStorage(this._store);
    }
    /**
     * Initialization function
     * @returns { Promise<void> }
     */
    public init(app: IApplication): Promise<void> {
        return new Promise((resolve, reject) => {
            this._app = app;
            Promise.all([
                this._init(),
                this._subscribe(),
            ]).then(() => {
                resolve();
            }).catch((error: Error) => {
                this._logger.error(`Fail initialize service due error: ${error.message}`);
                reject(error);
            });
        });
    }

    public destroy(): Promise<void> {
        return new Promise((resolve) => {
            Object.keys(this._subscriptions).forEach((key: string) => {
                (this._subscriptions as any)[key].destroy();
            });
            this._storage.destroy().catch((error: Error) => {
                this._logger.warn(`Error during destroy plugin's process: ${error.message}`);
            }).finally(() => {
                resolve();
            });
        });
    }

    public shutdown(): Promise<void> {
        return new Promise((resolve) => {
            this._storage.shutdown().catch((error: Error) => {
                this._logger.warn(`Error during destroy plugin's process: ${error.message}`);
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

    public addStream(session: string, connectionFactory: TConnectionFactory): Promise<void> {
        return this._storage.bindWithSession(session, connectionFactory);
    }

    public removedStream(session: string): Promise<void> {
        return this._storage.unbindWithSession(session);
    }

    public getSessionPluginsNames(): string[] {
        return this._storage.getNamesOfInstalled();
    }

    public revision() {
        this._store.remote().then(() => {
            this._logger.env(`Plugin's state is updated from remote store`);
        }).catch((error: Error) => {
            this._logger.env(`Fail to update plugin's state from remote store due error: ${error.message}`);
        }).finally(() => {
            if (!this._storage.hasToBeUpdatedOrInstalled()) {
                this._logger.debug(`No need to update or install plugins`);
                return;
            }
            this._storage.predownload();
            this._logger.debug(`Same plugins has to be updated or installed`);
            ServiceRenderState.do('ServicePlugins: NotifyRenderPluginsUpdate', () => {
                ServiceElectron.IPC.send(new ServiceElectron.IPCMessages.Notification({
                    caption: `Plugins`,
                    message: `Some plugins should be updated or installed. It requares restarting of chipmunk.`,
                    type: ServiceElectron.IPCMessages.Notification.Types.info,
                    session: '*',
                    actions: [
                        {
                            type: ServiceElectron.IPCMessages.ENotificationActionType.ipc,
                            value: 'PluginsUpdate',
                            caption: 'Restart Now',
                        },
                    ],
                })).catch((error: Error) => {
                    this._logger.warn(`Fail send Notification due error: ${error.message}`);
                });
            });
        });
    }

    public update(): Promise<void> {
        return new Promise((resolve, reject) => {
            if (!this._storage.hasToBeUpdatedOrInstalled()) {
                this._logger.debug(`No need to update or install plugins`);
                return resolve();
            }
            this._storage.update().then(() => {
                this._logger.debug(`Updating of plugins is done`);
            }).catch((updErr: Error) => {
                this._logger.warn(`Fail to update plugins due error: ${updErr.message}`);
            }).finally(() => {
                resolve();
            });
        });
    }

    public accomplish(): Promise<void> {
        return new Promise((resolve, reject) => {
            // Shutdown all plugins
            this.shutdown().then(() => {
                this._logger.debug(`All plugins are down`);
            }).catch((shutdownErr: Error) => {
                this._logger.warn(`Fail to shutdown all plugins before close due error: ${shutdownErr.message}`);
            }).finally(() => {
                // Update plugins
                this.update().then(() => {
                    this._logger.debug(`Plugins update workflow is done`);
                }).catch((updateErr: Error) => {
                    this._logger.warn(`Fail to shutdown all plugins before close due error: ${updateErr.message}`);
                }).finally(() => {
                    Promise.all([
                        this._storage.installPending().catch((error: Error) => {
                            this._logger.error(`Fail to install pending plugins due: ${error.message}`);
                            return Promise.resolve();
                        }),
                        this._storage.uninstallPending().catch((error: Error) => {
                            this._logger.error(`Fail to unnstall pending plugins due: ${error.message}`);
                            return Promise.resolve();
                        }),
                    ]).then(() => {
                        resolve();
                    });
                });
            });
        });
    }
    private _init(): Promise<void> {
        return new Promise((resolve, reject) => {
            // Read store information
            this._store.local().then(() => {
                this._logger.debug(`Plugins store data is load`);
            }).catch((storeErr: Error) => {
                this._logger.warn(`Fail load plugins store data due error: ${storeErr.message}`);
            }).finally(() => {
                // Read storage information
                this._storage.load().then(() => {
                    this._logger.debug(`Plugins storage data is load`);
                    this._storage.defaults().then(() => {
                        this._logger.debug(`Defaults plugins are checked`);
                    }).catch((defErr: Error) => {
                        this._logger.warn(`Fail to check default plugins due error: ${defErr.message}`);
                    }).finally(() => {
                        this._storage.logState();
                        // Start single process plugins
                        this._storage.runAllSingleProcess().catch((singleProcessRunErr: Error) => {
                            this._logger.warn(`Fail to start single process plugins due error: ${singleProcessRunErr.message}`);
                        });
                        ServiceRenderState.do('ServicePlugins: SendRenderPluginsData', this._sendRenderPluginsData.bind(this));
                        resolve();
                    });
                }).catch((storageErr: Error) => {
                    this._logger.warn(`Fail load plugins storage data due error: ${storageErr.message}`);
                    resolve();
                });
            });
        });
    }

    private _subscribe(): Promise<void> {
        return new Promise((resolve, reject) => {
            Promise.all([
                ServiceElectron.IPC.subscribe(IPCMessages.PluginsInstalledRequest, this._ipc_PluginsInstalledRequest.bind(this)).then((subscription: Subscription) => {
                    this._subscriptions.PluginsInstalledRequest = subscription;
                }),
                ServiceElectron.IPC.subscribe(IPCMessages.PluginsStoreAvailableRequest, this._ipc_PluginsStoreAvailableRequest.bind(this)).then((subscription: Subscription) => {
                    this._subscriptions.PluginsStoreAvailableRequest = subscription;
                }),
                ServiceElectron.IPC.subscribe(IPCMessages.PluginsUpdate, this._ipc_PluginsUpdate.bind(this)).then((subscription: Subscription) => {
                    this._subscriptions.PluginsUpdate = subscription;
                }),
                ServiceElectron.IPC.subscribe(IPCMessages.PluginsInstallRequest, this._ipc_PluginsInstallRequest.bind(this)).then((subscription: Subscription) => {
                    this._subscriptions.PluginsInstallRequest = subscription;
                }),
                ServiceElectron.IPC.subscribe(IPCMessages.PluginsUninstallRequest, this._ipc_PluginsUninstallRequest.bind(this)).then((subscription: Subscription) => {
                    this._subscriptions.PluginsUninstallRequest = subscription;
                }),
            ]).then(() => {
                resolve();
            }).catch(reject);
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

    private _ipc_PluginsInstalledRequest(message: IPCMessages.PluginsInstalledRequest, response: (instance: any) => any) {
        response(new IPCMessages.PluginsInstalledResponse({
            plugins: this._storage.getInstalled(),
        })).catch((error: Error) => {
            this._logger.warn(`Fail to send response on PluginsInstalledRequest due error: ${error.message}`);
        });
    }

    private _ipc_PluginsStoreAvailableRequest(message: IPCMessages.PluginsStoreAvailableRequest, response: (instance: any) => any) {
        response(new IPCMessages.PluginsStoreAvailableResponse({
            plugins: this._store.getAvailable(),
        })).catch((error: Error) => {
            this._logger.warn(`Fail to send response on PluginsStoreAvailableResponse due error: ${error.message}`);
        });
    }

    private _ipc_PluginsUpdate(message: IPCMessages.PluginsUpdate) {
        this._logger.debug(`Forsing quit of application`);
        this._app?.destroy();
    }

    private _ipc_PluginsInstallRequest(message: IPCMessages.TMessage, response: (instance: any) => any) {
        const msg: IPCMessages.PluginsInstallRequest = message as IPCMessages.PluginsInstallRequest;
        this._storage.add(msg.name).then(() => {
            response(new IPCMessages.PluginsInstallResponse({})).catch((error: Error) => {
                this._logger.warn(`Fail to send response on PluginsInstallResponse due error: ${error.message}`);
            });
        }).catch((addErr: Error) => {
            this._logger.warn(`Fail to delivery requested plugin "${msg.name}" due error: ${addErr.message}`);
            response(new IPCMessages.PluginsInstallResponse({
                error: addErr.message,
            })).catch((error: Error) => {
                this._logger.warn(`Fail to send response on PluginsInstallResponse due error: ${error.message}`);
            });
        });
    }

    private _ipc_PluginsUninstallRequest(message: IPCMessages.TMessage, response: (instance: any) => any) {
        const msg: IPCMessages.PluginsUninstallRequest = message as IPCMessages.PluginsUninstallRequest;
        this._storage.uninstall(msg.name).then(() => {
            response(new IPCMessages.PluginsUninstallResponse({})).catch((error: Error) => {
                this._logger.warn(`Fail to send response on PluginsUninstallResponse due error: ${error.message}`);
            });
        }).catch((removeErr: Error) => {
            this._logger.warn(`Fail to prepare for remove plugin "${msg.name}" due error: ${removeErr.message}`);
            response(new IPCMessages.PluginsUninstallResponse({
                error: removeErr.message,
            })).catch((error: Error) => {
                this._logger.warn(`Fail to send response on PluginsUninstallResponse due error: ${error.message}`);
            });
        });
    }

}

export default (new ServicePlugins());
