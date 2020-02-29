import Logger from '../tools/env.logger';
import ServiceElectron from './service.electron';
import ServiceElectronService from './service.electron.state';
import ServiceRenderState from './service.render.state';
import ControllerIPCPlugin from '../controllers/plugins/plugin.process.ipc';
import ControllerPluginStore from '../controllers/plugins/plugins.store';
import ControllerPluginStorage, { InstalledPlugin, TConnectionFactory } from '../controllers/plugins/plugins.storage';

import { IService } from '../interfaces/interface.service';
import { IPCMessages, Subscription } from './service.electron';

/**
 * @class ServicePluginNode
 * @description Looking for plugins, which should be attached on nodejs level
 */
export class ServicePlugins implements IService {

    private _logger: Logger = new Logger('ServicePluginNode');
    private _subscriptions: { [key: string ]: Subscription } = { };
    private _storage: ControllerPluginStorage;
    private _store: ControllerPluginStore;

    constructor() {
        this._store = new ControllerPluginStore();
        this._storage = new ControllerPluginStorage(this._store);
    }
    /**
     * Initialization function
     * @returns { Promise<void> }
     */
    public init(): Promise<void> {
        return new Promise((resolve, reject) => {
            // Read store information
            this._store.read().then(() => {
                this._logger.debug(`Plugins store data is load`);
            }).catch((storeErr: Error) => {
                this._logger.warn(`Fail load plugins store data due error: ${storeErr.message}`);
            }).finally(() => {
                // Read storage information
                this._storage.read().then(() => {
                    this._logger.debug(`Plugins storage data is load`);
                    // Update installed plugins
                    this._storage.update().catch((updateErr: Error) => {
                        this._logger.warn(`Update of plugins is failed with: ${updateErr.message}`)
                    }).finally(() => {
                        // Delivery default plugins
                        this._storage.defaults().then(() => {
                            this._storage.logState();
                            // Start single process plugins
                            this._storage.runAllSingleProcess().catch((singleProcessRunErr: Error) => {
                                this._logger.warn(`Fail to start single process plugins due error: ${singleProcessRunErr.message}`);
                            });
                            this._sendRenderPluginsData();
                            resolve();
                        });
                    });
                }).catch((storageErr: Error) => {
                    this._logger.warn(`Fail load plugins storage data due error: ${storageErr.message}`);
                    resolve();
                });
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

    /* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
    *   Redirection of messages
    * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
    public redirectIPCMessageToPluginHost(message: IPCMessages.PluginInternalMessage, sequence?: string) {
        const ipc: ControllerIPCPlugin | undefined = this.getPluginIPC(message.stream, message.token);
        if (ipc === undefined) {
            return this._logger.error(`Fail redirect message for plugin (token: ${message.token}), becase fail to get plugin's IPC`);
        }
        ipc.send(message, sequence).catch((sendingError: Error) => {
            this._logger.error(`Fail redirect message by token ${message.token} due error: ${sendingError.message}`);
        });
    }

    /* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
    *   Streams
    * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */

    public addStream(session: string, connectionFactory: TConnectionFactory): Promise<void> {
        return this._storage.bindWithSession(session, connectionFactory);
    }

    public removedStream(session: string): Promise<void> {
        return this._storage.unbindWithSession(session);
    }

    /* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
    *   Common
    * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
    public getSessionPluginsNames(): string[] {
        return this._storage.getNamesOfInstalled();
    }

    private _onRenderReady() {
        // Send infomation about verified plugins
        this._sendRenderPluginsData();
    }

    private _sendRenderPluginsData() {
        if (!ServiceRenderState.ready()) {
            this._subscriptions.onRenderReady = ServiceRenderState.getSubjects().onRenderReady.subscribe(this._onRenderReady.bind(this));
            return;
        }
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
